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
    constructor(onAlert) {
        this.onAlertCallback = onAlert;
        const homeDir = os.homedir();
        this.dbPath = path.join(homeDir, '.pi-desktop', 'pi.sqlite');
        // Initialize timestamp to current time to avoid historical alerts upon startup
        this.lastProcessedTimestamp = Date.now();
    }
    start() {
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
        }
        catch (err) {
            console.warn('[SoundAlert] FS watcher unavailable, fallbacking to interval polling:', err);
        }
        // 2. Fallback polling every 500ms for solid reliability
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
        // Secure query execution via execFile (no shell interpolation)
        const safeTs = Number.isFinite(this.lastProcessedTimestamp) ? Math.floor(this.lastProcessedTimestamp) : Date.now();
        const query = `SELECT id, kind, session_id, session_title, turn_id, created_at FROM notifications WHERE created_at > ${safeTs} ORDER BY created_at ASC;`;
        (0, node_child_process_1.execFile)('sqlite3', [this.dbPath, query], { timeout: 1500 }, (err, stdout) => {
            this.isChecking = false;
            if (err || !stdout || !stdout.trim()) {
                return;
            }
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                const [id, kind, sessionId, sessionTitle, turnId, createdAtStr] = line.split('|');
                const createdAt = parseInt(createdAtStr, 10);
                if (!isNaN(createdAt) && createdAt > this.lastProcessedTimestamp) {
                    this.lastProcessedTimestamp = createdAt;
                    const event = {
                        kind: kind,
                        turnId,
                        sessionId,
                        sessionTitle,
                        createdAt
                    };
                    const alertType = kind === 'task.failed' ? 'error' : 'complete';
                    this.onAlertCallback(alertType, event);
                }
            }
        });
    }
}
exports.TurnWatcher = TurnWatcher;
