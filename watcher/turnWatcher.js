"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnWatcher = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const node_child_process_1 = require("node:child_process");
class TurnWatcher {
    dbPath;
    lastProcessedTimestamp;
    isChecking = false;
    pollInterval = null;
    fileWatcher = null;
    onAlertCallback;
    processedIds = new Set();
    maxCachedIds = 200;
    constructor(onAlert) {
        this.onAlertCallback = onAlert;
        const homeDir = os.homedir();
        this.dbPath = path.join(homeDir, '.pi-desktop', 'pi.sqlite');
        // Start from current time to prevent historical alerts upon startup
        this.lastProcessedTimestamp = Date.now();
    }
    start() {
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
        }
        catch (err) {
            console.warn('[SoundAlert] FS watcher unavailable, fallbacking to interval polling:', err);
        }
        // 2. Continuous fallback interval polling (500ms) for high reliability
        this.pollInterval = setInterval(() => {
            this.checkNewNotifications();
        }, 500);
        // Initial check
        this.checkNewNotifications();
    }
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = null;
        }
    }
    checkNewNotifications() {
        if (this.isChecking || !fs.existsSync(this.dbPath))
            return;
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
                const stmt = db.prepare(`SELECT id, kind, session_id, session_title, turn_id, created_at FROM notifications WHERE created_at >= ? ORDER BY created_at ASC;`);
                const rows = stmt.all(safeTs);
                db.close();
                this.processRows(rows.map(r => ({
                    id: r.id,
                    kind: r.kind,
                    sessionId: r.session_id,
                    sessionTitle: r.session_title,
                    turnId: r.turn_id,
                    createdAt: Number(r.created_at)
                })));
                this.isChecking = false;
                return;
            }
        }
        catch (nodeSqliteErr) {
            // Fallback to Strategy 2 if node:sqlite throws or is not available
        }
        // Strategy 2: sqlite3 CLI with native -json formatting (avoids all pipe/delimiter collision issues)
        const query = `SELECT id, kind, session_id, session_title, turn_id, created_at FROM notifications WHERE created_at >= ${safeTs} ORDER BY created_at ASC;`;
        (0, node_child_process_1.execFile)('sqlite3', ['-json', this.dbPath, query], { timeout: 1500 }, (err, stdout) => {
            this.isChecking = false;
            if (err || !stdout || !stdout.trim()) {
                return;
            }
            try {
                const rows = JSON.parse(stdout.trim());
                if (Array.isArray(rows)) {
                    this.processRows(rows.map((r) => ({
                        id: r.id,
                        kind: r.kind,
                        sessionId: r.session_id,
                        sessionTitle: r.session_title,
                        turnId: r.turn_id,
                        createdAt: Number(r.created_at)
                    })));
                }
            }
            catch (parseErr) {
                console.error('[SoundAlert] Failed to parse notifications json:', parseErr);
            }
        });
    }
    processRows(rows) {
        for (const event of rows) {
            if (!event.id || this.processedIds.has(event.id)) {
                continue;
            }
            // Add to processed ID set with LRU-style bounded eviction
            this.processedIds.add(event.id);
            if (this.processedIds.size > this.maxCachedIds) {
                const first = this.processedIds.values().next().value;
                if (first)
                    this.processedIds.delete(first);
            }
            if (event.createdAt >= this.lastProcessedTimestamp) {
                this.lastProcessedTimestamp = event.createdAt;
            }
            const alertType = event.kind === 'task.failed' ? 'error' : 'complete';
            this.onAlertCallback(alertType, event);
        }
    }
}
exports.TurnWatcher = TurnWatcher;
