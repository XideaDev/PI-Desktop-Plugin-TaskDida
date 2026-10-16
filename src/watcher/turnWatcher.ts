import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { AlertType } from '../audio/player';

export interface TurnEvent {
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

  constructor(onAlert: (type: AlertType, event: TurnEvent) => void) {
    this.onAlertCallback = onAlert;
    const homeDir = os.homedir();
    this.dbPath = path.join(homeDir, '.pi-desktop', 'pi.sqlite');
    // Initialize timestamp to current time to avoid historical alerts upon startup
    this.lastProcessedTimestamp = Date.now();
  }

  public start() {
    if (!fs.existsSync(this.dbPath)) {
      console.warn(`[SoundAlert] Database not found at ${this.dbPath}, waiting...`);
    }

    // 1. Try file watcher on directory to capture WAL / DB writes
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

    // 2. Fallback polling every 500ms for solid reliability
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

    // Secure query execution via execFile (no shell interpolation)
    const safeTs = Number.isFinite(this.lastProcessedTimestamp) ? Math.floor(this.lastProcessedTimestamp) : Date.now();
    const query = `SELECT id, kind, session_id, session_title, turn_id, created_at FROM notifications WHERE created_at > ${safeTs} ORDER BY created_at ASC;`;

    execFile('sqlite3', [this.dbPath, query], { timeout: 1500 }, (err, stdout) => {
      this.isChecking = false;
      if (err || !stdout || !stdout.trim()) {
        return;
      }

      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const [id, kind, sessionId, sessionTitle, turnId, createdAtStr] = line.split('|');
        const createdAt = parseInt(createdAtStr, 10);
        if (!isNaN(createdAt) && createdAt > this.lastProcessedTimestamp) {
          this.lastProcessedTimestamp = createdAt;
          const event: TurnEvent = {
            kind: kind as 'task.completed' | 'task.failed',
            turnId,
            sessionId,
            sessionTitle,
            createdAt
          };

          const alertType: AlertType = kind === 'task.failed' ? 'error' : 'complete';
          this.onAlertCallback(alertType, event);
        }
      }
    });
  }
}
