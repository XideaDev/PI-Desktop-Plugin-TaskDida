"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioThrottler = void 0;
class AudioThrottler {
    lastGlobalPlayTime = 0;
    cooldownMs;
    lastTypePlayTime = new Map();
    // Minimum spacing between any two sounds to prevent acoustic phasing
    minSpacingMs = 400;
    constructor(cooldownSeconds = 2.0) {
        this.cooldownMs = cooldownSeconds * 1000;
    }
    setCooldown(seconds) {
        this.cooldownMs = Math.max(500, seconds * 1000);
    }
    /**
     * Evaluates concurrency and throttles appropriately:
     * 1. High-priority events (error, notify) can preempt general cooldown if minSpacingMs has passed.
     * 2. Repetitive events of the same type are subject to the full cooldown window.
     */
    canPlay(type = 'complete') {
        const now = Date.now();
        // Guard 1: Physical spacing to prevent instant overlap
        if (now - this.lastGlobalPlayTime < this.minSpacingMs) {
            return false;
        }
        // Guard 2: High priority events (error or user prompt) allow faster dispatch
        if (type === 'error' || type === 'notify') {
            const lastSameType = this.lastTypePlayTime.get(type) || 0;
            if (now - lastSameType >= 800) {
                this.recordPlay(type, now);
                return true;
            }
            return false;
        }
        // Guard 3: Subagent steps have short spacing (600ms)
        if (type === 'subagent') {
            const lastSameType = this.lastTypePlayTime.get(type) || 0;
            if (now - lastSameType >= 600) {
                this.recordPlay(type, now);
                return true;
            }
            return false;
        }
        // Guard 4: Default completion sound cooldown
        const lastSameType = this.lastTypePlayTime.get(type) || 0;
        if (now - this.lastGlobalPlayTime >= this.cooldownMs || now - lastSameType >= this.cooldownMs) {
            this.recordPlay(type, now);
            return true;
        }
        return false;
    }
    recordPlay(type, timestamp) {
        this.lastGlobalPlayTime = timestamp;
        this.lastTypePlayTime.set(type, timestamp);
    }
    reset() {
        this.lastGlobalPlayTime = 0;
        this.lastTypePlayTime.clear();
    }
}
exports.AudioThrottler = AudioThrottler;
