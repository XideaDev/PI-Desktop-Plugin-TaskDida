import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SoundAlertSettings } from '../config/settings';

export type AlertType = 'complete' | 'error' | 'notify' | 'subagent';

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
   * Resolve sound file path strictly prioritizing plugin bundled assets.
   * If custom audio fails or is missing, automatically falls back to bundled asset.
   */
  public resolveSoundPath(type: AlertType, settings: SoundAlertSettings): string {
    const defaultFileMap: Record<AlertType, string> = {
      complete: path.join(this.baseAssetsPath, 'complete.wav'),
      error: path.join(this.baseAssetsPath, 'error.wav'),
      notify: path.join(this.baseAssetsPath, 'notify.wav'),
      subagent: path.join(this.baseAssetsPath, 'subagent.wav')
    };

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

    return defaultFileMap[type] || defaultFileMap.complete;
  }

  /**
   * Play sound using OS native zero-dependency audio commands.
   * On Windows: Uses WMP COM player with volume control, falling back to System.Media.SoundPlayer.
   * On macOS: Uses afplay with volume option.
   * On Linux: Uses paplay with fallback to aplay.
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
    const volumePercent = Math.round(volumeFraction * 100);

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
          const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
            stdio: 'ignore',
            detached: true
          });
          proc.unref();
          proc.on('error', (err) => {
            console.error('[SoundAlert] Windows Audio Player error:', err);
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
