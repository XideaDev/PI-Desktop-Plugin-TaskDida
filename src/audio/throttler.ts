import { AlertType } from './player';

export class AudioThrottler {
  private lastGlobalPlayTime = 0;
  private cooldownMs: number;
  private lastTypePlayTime: Map<AlertType, number> = new Map();
  // Minimum spacing between any two sounds to prevent acoustic phasing
  private minSpacingMs = 400;

  constructor(cooldownSeconds = 2.0) {
    this.cooldownMs = cooldownSeconds * 1000;
  }

  public setCooldown(seconds: number) {
    this.cooldownMs = Math.max(500, seconds * 1000);
  }

  /**
   * Evaluates concurrency and throttles appropriately:
   * 1. High-priority events (error, notify) can preempt general cooldown if minSpacingMs has passed.
   * 2. Repetitive events of the same type are subject to the full cooldown window.
   */
  public canPlay(type: AlertType = 'complete'): boolean {
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

  private recordPlay(type: AlertType, timestamp: number) {
    this.lastGlobalPlayTime = timestamp;
    this.lastTypePlayTime.set(type, timestamp);
  }

  public reset() {
    this.lastGlobalPlayTime = 0;
    this.lastTypePlayTime.clear();
  }
}
