import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SoundAlertSettings } from '../config/settings';

export type AlertType = 'complete' | 'error' | 'notify';

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
export function isSafeAudioFile(filePath?: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  // Disallow control characters or newlines
  if (/[\r\n\0]/.test(filePath)) return false;

  const normalized = path.normalize(filePath);
  const ext = path.extname(normalized).toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) return false;

  try {
    const stat = fs.statSync(normalized);
    return stat.isFile();
  } catch {
    return false;
  }
}

export class NativeAudioPlayer {
  private baseAssetsPath: string;

  constructor(pluginRootDir: string) {
    this.baseAssetsPath = path.join(pluginRootDir, 'assets', 'sounds');
  }

  /**
   * Resolve appropriate sound file path based on settings and alert type
   */
  public resolveSoundPath(type: AlertType, settings: SoundAlertSettings): string {
    if (settings.soundTheme === 'custom') {
      if (type === 'complete' && isSafeAudioFile(settings.customSoundSuccess)) {
        return path.resolve(settings.customSoundSuccess!);
      }
      if (type === 'error' && isSafeAudioFile(settings.customSoundError)) {
        return path.resolve(settings.customSoundError!);
      }
      if (type === 'notify' && isSafeAudioFile(settings.customSoundNotify)) {
        return path.resolve(settings.customSoundNotify!);
      }
    }

    if (settings.soundTheme === 'system') {
      if (process.platform === 'darwin') {
        const sysMap: Record<AlertType, string> = {
          complete: '/System/Library/Sounds/Glass.aiff',
          error: '/System/Library/Sounds/Basso.aiff',
          notify: '/System/Library/Sounds/Tink.aiff'
        };
        const p = sysMap[type];
        if (fs.existsSync(p)) return p;
      } else if (process.platform === 'win32') {
        const winMap: Record<AlertType, string> = {
          complete: 'C:\\Windows\\Media\\chimes.wav',
          error: 'C:\\Windows\\Media\\chord.wav',
          notify: 'C:\\Windows\\Media\\ding.wav'
        };
        const p = winMap[type];
        if (fs.existsSync(p)) return p;
      }
    }

    // Default to built-in bundled sounds
    const fileMap: Record<AlertType, string> = {
      complete: path.join(this.baseAssetsPath, 'complete.wav'),
      error: path.join(this.baseAssetsPath, 'error.wav'),
      notify: path.join(this.baseAssetsPath, 'notify.wav')
    };

    return fileMap[type];
  }

  /**
   * Play sound using OS native zero-dependency audio commands.
   * Arguments are passed as arrays to child_process.spawn to prevent shell injection.
   */
  public async play(type: AlertType, settings: SoundAlertSettings, customPathOverride?: string): Promise<boolean> {
    if (!settings.enabled && !customPathOverride) return false;

    let soundPath: string;
    if (customPathOverride) {
      if (!isSafeAudioFile(customPathOverride)) {
        console.warn(`[SoundAlert] Rejected unsafe custom audio path: ${customPathOverride}`);
        return false;
      }
      soundPath = path.resolve(customPathOverride);
    } else {
      soundPath = this.resolveSoundPath(type, settings);
    }

    if (!fs.existsSync(soundPath)) {
      console.warn(`[SoundAlert] Sound file not found: ${soundPath}`);
      return false;
    }

    const platform = process.platform;
    const volumeFraction = Math.max(0, Math.min(100, settings.volume)) / 100;

    return new Promise((resolve) => {
      let settled = false;
      const safeResolve = (val: boolean) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };

      try {
        if (platform === 'darwin') {
          // macOS afplay supports volume option -v (0.0 to 1.0)
          const proc = spawn('afplay', ['-v', volumeFraction.toFixed(2), soundPath], {
            stdio: 'ignore',
            detached: true
          });
          proc.unref();
          proc.on('error', (err) => {
            console.error('[SoundAlert] macOS afplay error:', err);
            safeResolve(false);
          });
          proc.on('spawn', () => safeResolve(true));
        } else if (platform === 'win32') {
          // Windows PowerShell SoundPlayer with strictly escaped single quotes
          const escapedPath = soundPath.replace(/'/g, "''");
          const script = `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`;
          const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
            stdio: 'ignore',
            detached: true
          });
          proc.unref();
          proc.on('error', (err) => {
            console.error('[SoundAlert] Windows SoundPlayer error:', err);
            safeResolve(false);
          });
          proc.on('spawn', () => safeResolve(true));
        } else {
          // Linux fallback (paplay -> aplay)
          const proc = spawn('paplay', [soundPath], {
            stdio: 'ignore',
            detached: true
          });
          proc.unref();
          proc.on('error', () => {
            const fallback = spawn('aplay', [soundPath], { stdio: 'ignore', detached: true });
            fallback.unref();
            fallback.on('error', () => safeResolve(false));
            fallback.on('spawn', () => safeResolve(true));
          });
          proc.on('spawn', () => safeResolve(true));
        }
      } catch (err) {
        console.error('[SoundAlert] Failed to spawn audio process:', err);
        safeResolve(false);
      }
    });
  }
}
