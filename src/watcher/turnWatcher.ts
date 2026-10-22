import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { AlertType } from '../audio/player';

export interface TurnEvent {
  id?: string;
  kind: 'task.completed' | 'task.failed';
  turnId: string;
  sessionId: string;
  sessionTitle: string;
  createdAt: number;
}

export class TurnWatcher {
  private dbPath: string;
  private lastProcessedTimestamp: number;
  private isChecking = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private onAlertCallback: (type: AlertType, event: TurnEvent) => void;
  private processedIds = new Set<string>();
  private maxCachedIds = 200;

  constructor(onAlert: (type: AlertType, event: TurnEvent) => void) {
    this.onAlertCallback = onAlert;
    const homeDir = os.homedir();
    this.dbPath = path.join(homeDir, '.pi-desktop', 'pi.sqlite');
    // Start from current time to prevent historical alerts upon startup
    this.lastProcessedTimestamp = Date.now();
  }

  public start() {
    if (!fs.existsSync(this.dbPath)) {
      console.warn(`[SoundAlert] Database not found at ${this.dbPath}, waiting...`);
    }

    // 1. Directory file watcher to capture immediate WAL / DB flushes
    const dir = path.dirname(this.dbPath);
    try {
      this.fileWatcher = fs.watch(dir, (eventType, filename) => {
        if (filename && (filename.includes('pi.sqlite') || filename.includes('pi.sqlite-wal'))) {
          this.checkNewNotifications();
        }
      });
    } catch (err) {
      console.warn('[SoundAlert] FS watcher unavailable, fallbacking to interval polling:', err);
    }

    // 2. Continuous fallback interval polling (500ms) for high reliability
    this.pollInterval = setInterval(() => {
      this.checkNewNotifications();
    }, 500);

    // Initial check
    this.checkNewNotifications();
  }

  public stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }

  private checkNewNotifications() {
    if (this.isChecking || !fs.existsSync(this.dbPath)) return;
    this.isChecking = true;

    const safeTs = Number.isFinite(this.lastProcessedTimestamp)
      ? Math.floor(this.lastProcessedTimestamp)
      : Date.now();

    // Strategy 1 (Preferred): Node 22+ native node:sqlite DatabaseSync (cross-platform, zero child-process overhead)
    try {
      // Dynamic require to prevent errors on environments without node:sqlite
      const sqliteModule = require('node:sqlite');
      if (sqliteModule && typeof sqliteModule.DatabaseSync === 'function') {
        const db = new sqliteModule.DatabaseSync(this.dbPath, { readOnly: true });
        const stmt = db.prepare(
          `SELECT id, kind, session_id, session_title, turn_id, created_at FROM notifications WHERE created_at >= ? ORDER BY created_at ASC;`
        );
        const rows = stmt.all(safeTs) as Array<{
          id: string;
          kind: string;
          session_id: string;
          session_title: string;
          turn_id: string;
          created_at: number;
        }>;
        db.close();

        this.processRows(rows.map(r => ({
          id: r.id,
          kind: r.kind as any,
          sessionId: r.session_id,
          sessionTitle: r.session_title,
          turnId: r.turn_id,
          createdAt: Number(r.created_at)
        })));
        this.isChecking = false;
        return;
      }
    } catch (nodeSqliteErr) {
      // Fallback to Strategy 2 if node:sqlite throws or is not available
    }

    // Strategy 2: sqlite3 CLI with native -json formatting (avoids all pipe/delimiter collision issues)
    const query = `SELECT id, kind, session_id, session_title, turn_id, created_at FROM notifications WHERE created_at >= ${safeTs} ORDER BY created_at ASC;`;

    execFile('sqlite3', ['-json', this.dbPath, query], { timeout: 1500 }, (err, stdout) => {
      this.isChecking = false;
      if (err || !stdout || !stdout.trim()) {
        return;
      }

      try {
        const rows = JSON.parse(stdout.trim());
        if (Array.isArray(rows)) {
          this.processRows(rows.map((r: any) => ({
            id: r.id,
            kind: r.kind,
            sessionId: r.session_id,
            sessionTitle: r.session_title,
            turnId: r.turn_id,
            createdAt: Number(r.created_at)
          })));
        }
      } catch (parseErr) {
        console.error('[SoundAlert] Failed to parse notifications json:', parseErr);
      }
    });
  }

  private processRows(rows: TurnEvent[]) {
    for (const event of rows) {
      if (!event.id || this.processedIds.has(event.id)) {
        continue;
      }

      // Add to processed ID set with LRU-style bounded eviction
      this.processedIds.add(event.id);
      if (this.processedIds.size > this.maxCachedIds) {
        const first = this.processedIds.values().next().value;
        if (first) this.processedIds.delete(first);
      }

      if (event.createdAt >= this.lastProcessedTimestamp) {
        this.lastProcessedTimestamp = event.createdAt;
      }

      const alertType: AlertType = event.kind === 'task.failed' ? 'error' : 'complete';
      this.onAlertCallback(alertType, event);
    }
  }
}
