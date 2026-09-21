/** Allows at most `max` acquisitions in any rolling `windowMs`. */
export class SlidingWindowLimiter {
  private readonly stamps: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (this.stamps.length > 0 && this.stamps[0]! <= now - this.windowMs) this.stamps.shift();
      if (this.stamps.length < this.max) {
        this.stamps.push(now);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, this.stamps[0]! + this.windowMs - now));
    }
  }
}
