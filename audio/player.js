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
exports.NativeAudioPlayer = void 0;
exports.isSafeAudioFile = isSafeAudioFile;
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const ALLOWED_AUDIO_EXTENSIONS = new Set([
    '.wav',
    '.mp3',
    '.ogg',
    '.aiff',
    '.aif',
    '.flac',
    '.m4a'
]);
/**
 * Validates that a user-specified path is a real, accessible audio file
 * and not an executable or malicious script.
 */
function isSafeAudioFile(filePath) {
    if (!filePath || typeof filePath !== 'string')
        return false;
    if (/[\r\n\0]/.test(filePath))
        return false;
    const normalized = path.normalize(filePath);
    const ext = path.extname(normalized).toLowerCase();
    if (!ALLOWED_AUDIO_EXTENSIONS.has(ext))
        return false;
    try {
        const stat = fs.statSync(normalized);
        return stat.isFile();
    }
    catch {
        return false;
    }
}
class NativeAudioPlayer {
    baseAssetsPath;
    constructor(pluginRootDir) {
        this.baseAssetsPath = path.join(pluginRootDir, 'assets', 'sounds');
    }
    /**
     * Resolve sound file path strictly prioritizing plugin bundled assets.
     * If custom audio fails or is missing, automatically falls back to bundled asset.
     */
    resolveSoundPath(type, settings) {
        const defaultFileMap = {
            complete: path.join(this.baseAssetsPath, 'complete.wav'),
            error: path.join(this.baseAssetsPath, 'error.wav'),
            notify: path.join(this.baseAssetsPath, 'notify.wav'),
            subagent: path.join(this.baseAssetsPath, 'subagent.wav')
        };
        if (settings.soundTheme === 'custom') {
            if (type === 'complete' && isSafeAudioFile(settings.customSoundSuccess)) {
                return path.resolve(settings.customSoundSuccess);
            }
            if (type === 'error' && isSafeAudioFile(settings.customSoundError)) {
                return path.resolve(settings.customSoundError);
            }
            if (type === 'notify' && isSafeAudioFile(settings.customSoundNotify)) {
                return path.resolve(settings.customSoundNotify);
            }
        }
        return defaultFileMap[type] || defaultFileMap.complete;
    }
    /**
     * Play sound using OS native zero-dependency audio commands.
     * On Windows: Uses WMP COM player with volume control, falling back to System.Media.SoundPlayer.
     * On macOS: Uses afplay with volume option.
     * On Linux: Uses paplay with fallback to aplay.
     */
    async play(type, settings, customPathOverride) {
        if (!settings.enabled && !customPathOverride)
            return false;
        let soundPath;
        if (customPathOverride) {
            if (!isSafeAudioFile(customPathOverride)) {
                console.warn(`[SoundAlert] Rejected unsafe custom audio path: ${customPathOverride}`);
                return false;
            }
            soundPath = path.resolve(customPathOverride);
        }
        else {
            soundPath = this.resolveSoundPath(type, settings);
        }
        if (!fs.existsSync(soundPath)) {
            console.warn(`[SoundAlert] Sound file not found: ${soundPath}`);
            return false;
        }
        const platform = process.platform;
        const volumeFraction = Math.max(0, Math.min(100, settings.volume)) / 100;
        const volumePercent = Math.round(volumeFraction * 100);
        return new Promise((resolve) => {
            let settled = false;
            const safeResolve = (val) => {
                if (!settled) {
                    settled = true;
                    resolve(val);
                }
            };
            try {
                if (platform === 'darwin') {
                    // macOS afplay supports volume option -v (0.0 to 1.0)
                    const proc = (0, node_child_process_1.spawn)('afplay', ['-v', volumeFraction.toFixed(2), soundPath], {
                        stdio: 'ignore',
                        detached: true
                    });
                    proc.unref();
                    proc.on('error', (err) => {
                        console.error('[SoundAlert] macOS afplay error:', err);
                        safeResolve(false);
                    });
                    proc.on('spawn', () => safeResolve(true));
                }
                else if (platform === 'win32') {
                    // Windows: WMP COM object for full volume & mp3/wav support, with SoundPlayer fallback
                    const escapedPath = soundPath.replace(/'/g, "''");
                    const script = `
            try {
              $p = New-Object -ComObject wmplayer.ocx;
              $p.URL = '${escapedPath}';
              $p.settings.volume = ${volumePercent};
              $p.controls.play();
              Start-Sleep -Milliseconds 1200;
            } catch {
              (New-Object Media.SoundPlayer '${escapedPath}').PlaySync();
            }
          `;
                    const proc = (0, node_child_process_1.spawn)('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
                        stdio: 'ignore',
                        detached: true
                    });
                    proc.unref();
                    proc.on('error', (err) => {
                        console.error('[SoundAlert] Windows Audio Player error:', err);
                        safeResolve(false);
                    });
                    proc.on('spawn', () => safeResolve(true));
                }
                else {
                    // Linux fallback (paplay -> aplay)
                    const proc = (0, node_child_process_1.spawn)('paplay', [soundPath], {
                        stdio: 'ignore',
                        detached: true
                    });
                    proc.unref();
                    proc.on('error', () => {
                        const fallback = (0, node_child_process_1.spawn)('aplay', [soundPath], { stdio: 'ignore', detached: true });
                        fallback.unref();
                        fallback.on('error', () => safeResolve(false));
                        fallback.on('spawn', () => safeResolve(true));
                    });
                    proc.on('spawn', () => safeResolve(true));
                }
            }
            catch (err) {
                console.error('[SoundAlert] Failed to spawn audio process:', err);
                safeResolve(false);
            }
        });
    }
}
exports.NativeAudioPlayer = NativeAudioPlayer;
