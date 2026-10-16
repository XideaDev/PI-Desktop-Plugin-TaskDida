export class AudioThrottler {
  private lastPlayTime = 0;
  private cooldownMs: number;

  constructor(cooldownSeconds = 2.0) {
    this.cooldownMs = cooldownSeconds * 1000;
  }

  public setCooldown(seconds: number) {
    this.cooldownMs = Math.max(500, seconds * 1000);
  }

  public canPlay(): boolean {
    const now = Date.now();
    if (now - this.lastPlayTime >= this.cooldownMs) {
      this.lastPlayTime = now;
      return true;
    }
    return false;
  }

  public reset() {
    this.lastPlayTime = 0;
  }
}
