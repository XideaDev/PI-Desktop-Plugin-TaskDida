"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioThrottler = void 0;
class AudioThrottler {
    lastPlayTime = 0;
    cooldownMs;
    constructor(cooldownSeconds = 2.0) {
        this.cooldownMs = cooldownSeconds * 1000;
    }
    setCooldown(seconds) {
        this.cooldownMs = Math.max(500, seconds * 1000);
    }
    canPlay() {
        const now = Date.now();
        if (now - this.lastPlayTime >= this.cooldownMs) {
            this.lastPlayTime = now;
            return true;
        }
        return false;
    }
    reset() {
        this.lastPlayTime = 0;
    }
}
exports.AudioThrottler = AudioThrottler;
