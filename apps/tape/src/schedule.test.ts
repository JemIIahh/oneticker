import { describe, expect, it } from 'vitest';
import { msUntilNextSlot, previousUtcDay } from './schedule';

describe('msUntilNextSlot', () => {
  it('waits for the next 5-minute mark', () => {
    expect(msUntilNextSlot(Date.parse('2026-09-24T19:58:30.000Z'), 300)).toBe(90_000);
  });

  it('waits a full interval when exactly on a mark', () => {
    expect(msUntilNextSlot(Date.parse('2026-09-24T20:00:00.000Z'), 300)).toBe(300_000);
  });
});

describe('previousUtcDay', () => {
  it('uses the UTC date, not local time', () => {
    expect(previousUtcDay(new Date('2026-09-26T00:30:00.000Z'))).toBe('2026-09-25');
  });
});
