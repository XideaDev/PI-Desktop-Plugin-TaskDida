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
exports.onLoad = onLoad;
exports.onUnload = onUnload;
exports.onPanelInvoke = onPanelInvoke;
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const player_1 = require("./audio/player");
const throttler_1 = require("./audio/throttler");
const turnWatcher_1 = require("./watcher/turnWatcher");
const settings_1 = require("./config/settings");
const focusDetector_1 = require("./audio/focusDetector");
class SoundAlertPlugin {
    player;
    throttler;
    watcher = null;
    settings = { ...settings_1.DEFAULT_SETTINGS };
    pluginRootDir;
    configFilePath;
    registeredEventHandlers = [];
    constructor() {
        this.pluginRootDir = __dirname;
        this.configFilePath = path.join(this.pluginRootDir, 'settings.json');
        this.player = new player_1.NativeAudioPlayer(this.pluginRootDir);
        this.throttler = new throttler_1.AudioThrottler(this.settings.debounceSeconds);
    }
    async onLoad() {
        console.log('[SoundAlert] Loading Task Sound Alert Plugin...');
        this.loadSettings();
        // 1. Initialize and start background DB & notification watcher
        this.watcher = new turnWatcher_1.TurnWatcher((type, event) => {
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
            }
            catch (err) {
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
            }
            catch (err) {
                console.warn('[SoundAlert] Failed to bind pi.events:', err);
            }
        }
        console.log('[SoundAlert] Task Sound Alert Plugin active.');
    }
    async onUnload() {
        console.log('[SoundAlert] Unloading Sound Alert Plugin...');
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
        if (typeof pi !== 'undefined' && pi.commands?.unregister) {
            try {
                await pi.commands.unregister('task-dida.openSettings');
            }
            catch { }
        }
        // Unbind all host event listeners to avoid memory leak and duplicate alerts on reload
        if (typeof pi !== 'undefined' && pi.events?.off) {
            for (const { event, handler } of this.registeredEventHandlers) {
                try {
                    pi.events.off(event, handler);
                }
                catch (err) {
                    console.warn(`[SoundAlert] Failed to off event ${event}:`, err);
                }
            }
        }
        this.registeredEventHandlers = [];
    }
    addHostEventListener(event, handler) {
        if (typeof pi !== 'undefined' && pi.events?.on) {
            pi.events.on(event, handler);
            this.registeredEventHandlers.push({ event, handler });
        }
    }
    loadSettings() {
        let localConfig = {};
        if (fs.existsSync(this.configFilePath)) {
            try {
                localConfig = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
            }
            catch (err) {
                console.warn('[SoundAlert] Failed to parse settings.json:', err);
            }
        }
        if (typeof pi !== 'undefined' && pi.config?.get) {
            this.settings.enabled = pi.config.get('soundAlert.enabled', localConfig.enabled ?? settings_1.DEFAULT_SETTINGS.enabled);
            this.settings.soundTheme = pi.config.get('soundAlert.soundTheme', localConfig.soundTheme ?? settings_1.DEFAULT_SETTINGS.soundTheme);
            this.settings.volume = pi.config.get('soundAlert.volume', localConfig.volume ?? settings_1.DEFAULT_SETTINGS.volume);
            this.settings.playOnSuccess = pi.config.get('soundAlert.playOnSuccess', localConfig.playOnSuccess ?? settings_1.DEFAULT_SETTINGS.playOnSuccess);
            this.settings.playOnError = pi.config.get('soundAlert.playOnError', localConfig.playOnError ?? settings_1.DEFAULT_SETTINGS.playOnError);
            this.settings.playOnNotify = pi.config.get('soundAlert.playOnNotify', localConfig.playOnNotify ?? settings_1.DEFAULT_SETTINGS.playOnNotify);
            this.settings.overrideHostBeep = pi.config.get('soundAlert.overrideHostBeep', localConfig.overrideHostBeep ?? settings_1.DEFAULT_SETTINGS.overrideHostBeep);
            this.settings.onlyWhenBlurred = pi.config.get('soundAlert.onlyWhenBlurred', localConfig.onlyWhenBlurred ?? settings_1.DEFAULT_SETTINGS.onlyWhenBlurred);
            this.settings.debounceSeconds = pi.config.get('soundAlert.debounceSeconds', localConfig.debounceSeconds ?? settings_1.DEFAULT_SETTINGS.debounceSeconds);
        }
        else {
            this.settings = { ...settings_1.DEFAULT_SETTINGS, ...localConfig };
        }
        this.settings.customSoundSuccess = localConfig.customSoundSuccess ?? '';
        this.settings.customSoundError = localConfig.customSoundError ?? '';
        this.settings.customSoundNotify = localConfig.customSoundNotify ?? '';
        this.throttler.setCooldown(this.settings.debounceSeconds);
        return this.settings;
    }
    async saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        // 1. Save to local JSON file
        try {
            fs.writeFileSync(this.configFilePath, JSON.stringify(this.settings, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[SoundAlert] Failed to write settings.json:', err);
        }
        // 2. Sync to host pi.config if available
        if (typeof pi !== 'undefined' && pi.config?.set) {
            for (const [key, value] of Object.entries(this.settings)) {
                await pi.config.set(`soundAlert.${key}`, value).catch(() => { });
            }
        }
        this.throttler.setCooldown(this.settings.debounceSeconds);
        return this.settings;
    }
    handleTurnEvent(type, event) {
        if (type === 'complete' && !this.settings.playOnSuccess)
            return;
        if (type === 'error' && !this.settings.playOnError)
            return;
        this.triggerAlert(type, `Turn: ${event.sessionTitle || event.sessionId}`);
    }
    async triggerAlert(type, reason) {
        if (!this.settings.enabled)
            return;
        // Check onlyWhenBlurred setting: if enabled and app is focused, suppress sound
        if (this.settings.onlyWhenBlurred) {
            const focused = await (0, focusDetector_1.isAppFocused)();
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
    async testPlay(type, customPath, tempVolume) {
        const testConfig = { ...this.settings };
        if (typeof tempVolume === 'number') {
            testConfig.volume = tempVolume;
        }
        console.log(`[SoundAlert] Test playing: ${type}, customPath: ${customPath || 'none'}`);
        return await this.player.play(type, testConfig, customPath);
    }
    getSettings() {
        return this.settings;
    }
}
const pluginInstance = new SoundAlertPlugin();
async function onLoad() {
    await pluginInstance.onLoad();
}
async function onUnload() {
    await pluginInstance.onUnload();
}
/**
 * Custom RPC invoked from renderer webview panel
 */
async function onPanelInvoke(channel, payload) {
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
    triggerAlert: (type) => pluginInstance.triggerAlert(type)
};
