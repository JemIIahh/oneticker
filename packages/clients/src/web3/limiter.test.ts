import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlidingWindowLimiter } from './limiter';

describe('SlidingWindowLimiter', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  it('lets 5 through at once and holds the 6th until the window rolls', async () => {
    const limiter = new SlidingWindowLimiter(5, 1000);
    const granted: number[] = [];
    const all = Array.from({ length: 6 }, () => limiter.acquire().then(() => granted.push(Date.now())));

    await vi.advanceTimersByTimeAsync(0);
    expect(granted).toEqual([0, 0, 0, 0, 0]);

    await vi.advanceTimersByTimeAsync(999);
    expect(granted).toHaveLength(5);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.all(all);
    expect(granted).toEqual([0, 0, 0, 0, 0, 1000]);
  });
});
