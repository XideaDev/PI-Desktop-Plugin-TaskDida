import * as path from 'node:path';
import * as fs from 'node:fs';
import { NativeAudioPlayer, AlertType } from './audio/player';
import { AudioThrottler } from './audio/throttler';
import { TurnWatcher, TurnEvent } from './watcher/turnWatcher';
import { SoundAlertSettings, DEFAULT_SETTINGS } from './config/settings';
import { isAppFocused } from './audio/focusDetector';

// Global plugin context provided by PI-Desktop host
declare const pi: {
  config?: {
    get<T = any>(key: string, defaultValue?: T): T;
    set(key: string, value: any): Promise<void>;
  };
  commands?: {
    register(cmd: { id: string; title: string; keywords?: string[]; run: () => Promise<void> | void }): Promise<void>;
    unregister(id: string): Promise<void>;
  };
  ui?: {
    openPanel(options?: { title?: string }): Promise<void>;
  };
  events?: {
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
  };
};

class SoundAlertPlugin {
  private player: NativeAudioPlayer;
  private throttler: AudioThrottler;
  private watcher: TurnWatcher | null = null;
  private settings: SoundAlertSettings = { ...DEFAULT_SETTINGS };
  private pluginRootDir: string;
  private configFilePath: string;
  private registeredEventHandlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  constructor() {
    this.pluginRootDir = __dirname;
    this.configFilePath = path.join(this.pluginRootDir, 'settings.json');
    this.player = new NativeAudioPlayer(this.pluginRootDir);
    this.throttler = new AudioThrottler(this.settings.debounceSeconds);
  }

  public async onLoad(): Promise<void> {
    console.log('[SoundAlert] Loading Task Sound Alert Plugin...');
    this.loadSettings();

    // 1. Initialize and start background DB & notification watcher
    this.watcher = new TurnWatcher((type: AlertType, event: TurnEvent) => {
      this.handleTurnEvent(type, event);
    });
    this.watcher.start();

    // 2. Register command to open settings panel
    if (typeof pi !== 'undefined' && pi.commands?.register) {
      try {
        await pi.commands.register({
          id: 'task-dida.openSettings',
          title: '任务提示音: 打开设置面板',
          keywords: ['taskdida', 'dida', 'sound', 'alert', '声音', '提示音', '试听', '设置'],
          run: async () => {
            if (pi.ui?.openPanel) {
              await pi.ui.openPanel({ title: '任务提示音 设置' });
            }
          }
        });
      } catch (err) {
        console.warn('[SoundAlert] Failed to register command:', err);
      }
    }

    // 3. Hook host events if available (with unregister tracking)
    if (typeof pi !== 'undefined' && pi.events) {
      try {
        const onDone = () => {
          this.triggerAlert('complete', 'Host agent:done event');
        };
        const onError = () => {
          this.triggerAlert('error', 'Host agent:error event');
        };
        const onNotificationSound = () => {
          if (this.settings.overrideHostBeep && this.settings.playOnNotify) {
            this.triggerAlert('notify', 'Host notificationSound intercepted');
          }
        };
        const onAsk = () => {
          if (this.settings.overrideHostBeep && this.settings.playOnNotify) {
            this.triggerAlert('notify', 'Host agent:ask intercepted');
          }
        };
        const onSubagent = () => {
          if (this.settings.playOnSubagent) {
            this.triggerAlert('subagent', 'Host subagent done');
          }
        };

        this.addHostEventListener('agent:done', onDone);
        this.addHostEventListener('agent:error', onError);
        this.addHostEventListener('notificationSound', onNotificationSound);
        this.addHostEventListener('agent:ask', onAsk);
        this.addHostEventListener('subagent:done', onSubagent);
      } catch (err) {
        console.warn('[SoundAlert] Failed to bind pi.events:', err);
      }
    }

    console.log('[SoundAlert] Task Sound Alert Plugin active.');
  }

  public async onUnload(): Promise<void> {
    console.log('[SoundAlert] Unloading Sound Alert Plugin...');
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }

    if (typeof pi !== 'undefined' && pi.commands?.unregister) {
      try {
        await pi.commands.unregister('task-dida.openSettings');
      } catch {}
    }

    // Unbind all host event listeners to avoid memory leak and duplicate alerts on reload
    if (typeof pi !== 'undefined' && pi.events?.off) {
      for (const { event, handler } of this.registeredEventHandlers) {
        try {
          pi.events.off(event, handler);
        } catch (err) {
          console.warn(`[SoundAlert] Failed to off event ${event}:`, err);
        }
      }
    }
    this.registeredEventHandlers = [];
  }

  private addHostEventListener(event: string, handler: (...args: any[]) => void) {
    if (typeof pi !== 'undefined' && pi.events?.on) {
      pi.events.on(event, handler);
      this.registeredEventHandlers.push({ event, handler });
    }
  }

  public loadSettings(): SoundAlertSettings {
    let localConfig: Partial<SoundAlertSettings> = {};
    if (fs.existsSync(this.configFilePath)) {
      try {
        localConfig = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
      } catch (err) {
        console.warn('[SoundAlert] Failed to parse settings.json:', err);
      }
    }

    if (typeof pi !== 'undefined' && pi.config?.get) {
      this.settings.enabled = pi.config.get('soundAlert.enabled', localConfig.enabled ?? DEFAULT_SETTINGS.enabled);
      this.settings.soundTheme = pi.config.get('soundAlert.soundTheme', localConfig.soundTheme ?? DEFAULT_SETTINGS.soundTheme);
      this.settings.volume = pi.config.get('soundAlert.volume', localConfig.volume ?? DEFAULT_SETTINGS.volume);
      this.settings.playOnSuccess = pi.config.get('soundAlert.playOnSuccess', localConfig.playOnSuccess ?? DEFAULT_SETTINGS.playOnSuccess);
      this.settings.playOnError = pi.config.get('soundAlert.playOnError', localConfig.playOnError ?? DEFAULT_SETTINGS.playOnError);
      this.settings.playOnNotify = pi.config.get('soundAlert.playOnNotify', localConfig.playOnNotify ?? DEFAULT_SETTINGS.playOnNotify);
      this.settings.overrideHostBeep = pi.config.get('soundAlert.overrideHostBeep', localConfig.overrideHostBeep ?? DEFAULT_SETTINGS.overrideHostBeep);
      this.settings.onlyWhenBlurred = pi.config.get('soundAlert.onlyWhenBlurred', localConfig.onlyWhenBlurred ?? DEFAULT_SETTINGS.onlyWhenBlurred);
      this.settings.debounceSeconds = pi.config.get('soundAlert.debounceSeconds', localConfig.debounceSeconds ?? DEFAULT_SETTINGS.debounceSeconds);
    } else {
      this.settings = { ...DEFAULT_SETTINGS, ...localConfig };
    }

    this.settings.customSoundSuccess = localConfig.customSoundSuccess ?? '';
    this.settings.customSoundError = localConfig.customSoundError ?? '';
    this.settings.customSoundNotify = localConfig.customSoundNotify ?? '';

    this.throttler.setCooldown(this.settings.debounceSeconds);
    return this.settings;
  }

  public async saveSettings(newSettings: Partial<SoundAlertSettings>): Promise<SoundAlertSettings> {
    this.settings = { ...this.settings, ...newSettings };

    // 1. Save to local JSON file
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SoundAlert] Failed to write settings.json:', err);
    }

    // 2. Sync to host pi.config if available
    if (typeof pi !== 'undefined' && pi.config?.set) {
      for (const [key, value] of Object.entries(this.settings)) {
        await pi.config.set(`soundAlert.${key}`, value).catch(() => {});
      }
    }

    this.throttler.setCooldown(this.settings.debounceSeconds);
    return this.settings;
  }

  private handleTurnEvent(type: AlertType, event: TurnEvent) {
    if (type === 'complete' && !this.settings.playOnSuccess) return;
    if (type === 'error' && !this.settings.playOnError) return;

    this.triggerAlert(type, `Turn: ${event.sessionTitle || event.sessionId}`);
  }

  public async triggerAlert(type: AlertType, reason?: string) {
    if (!this.settings.enabled) return;

    // Check onlyWhenBlurred setting: if enabled and app is focused, suppress sound
    if (this.settings.onlyWhenBlurred) {
      const focused = await isAppFocused();
      if (focused) {
        console.log(`[SoundAlert] App is focused and onlyWhenBlurred is enabled. Skip alert.`);
        return;
      }
    }

    if (!this.throttler.canPlay(type)) {
      console.log(`[SoundAlert] Throttled alert (${type}) within cooldown period. Skip.`);
      return;
    }

    console.log(`[SoundAlert] Playing sound for [${type}] ${reason ? `(${reason})` : ''}`);
    await this.player.play(type, this.settings);
  }

  public async testPlay(type: AlertType, customPath?: string, tempVolume?: number): Promise<boolean> {
    const testConfig = { ...this.settings };
    if (typeof tempVolume === 'number') {
      testConfig.volume = tempVolume;
    }
    console.log(`[SoundAlert] Test playing: ${type}, customPath: ${customPath || 'none'}`);
    return await this.player.play(type, testConfig, customPath);
  }

  public getSettings(): SoundAlertSettings {
    return this.settings;
  }
}

const pluginInstance = new SoundAlertPlugin();

export async function onLoad() {
  await pluginInstance.onLoad();
}

export async function onUnload() {
  await pluginInstance.onUnload();
}

/**
 * Custom RPC invoked from renderer webview panel
 */
export async function onPanelInvoke(channel: string, payload: any): Promise<any> {
  switch (channel) {
    case 'soundAlert.getSettings':
      return { ok: true, settings: pluginInstance.getSettings() };

    case 'soundAlert.saveSettings': {
      const saved = await pluginInstance.saveSettings(payload?.settings || {});
      return { ok: true, settings: saved };
    }

    case 'soundAlert.testPlay': {
      const { type, customPath, volume } = payload || {};
      const success = await pluginInstance.testPlay(type || 'complete', customPath, volume);
      return { ok: success };
    }

    default:
      throw new Error(`[SoundAlert] Unknown panel invoke channel: ${channel}`);
  }
}

// CommonJS export
module.exports = {
  onLoad,
  onUnload,
  onPanelInvoke,
  triggerAlert: (type: AlertType) => pluginInstance.triggerAlert(type)
};
