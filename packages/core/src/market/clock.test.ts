import { describe, expect, it } from 'vitest';
import { marketClock } from './clock';

const at = (iso: string) => marketClock(new Date(iso));
const iso = (d: Date) => d.toISOString();

// Until 1 Nov 2026 ET is UTC-4; after, UTC-5.
describe('marketClock: state at boundaries', () => {
  it.each([
    ['2026-09-25T19:59:59Z', 'REGULAR', 'Fri 15:59:59 ET, last second of the session'],
    ['2026-09-25T20:00:00Z', 'POST', 'Fri 16:00 ET, the close'],
    ['2026-09-25T23:59:59Z', 'POST', 'Fri 19:59:59 ET'],
    ['2026-09-26T00:00:00Z', 'WEEKEND', 'Fri 20:00 ET, weekend starts'],
    ['2026-09-27T23:59:59Z', 'WEEKEND', 'Sun 19:59:59 ET'],
    ['2026-09-28T00:00:00Z', 'OVERNIGHT', 'Sun 20:00 ET, overnight session starts'],
    ['2026-09-28T07:59:59Z', 'OVERNIGHT', 'Mon 03:59:59 ET'],
    ['2026-09-28T08:00:00Z', 'PRE', 'Mon 04:00 ET, pre-market opens'],
    ['2026-09-28T13:29:59Z', 'PRE', 'Mon 09:29:59 ET'],
    ['2026-09-28T13:30:00Z', 'REGULAR', 'Mon 09:30 ET, the open'],
    ['2026-09-29T00:00:00Z', 'OVERNIGHT', 'Mon 20:00 ET'],
    ['2026-10-30T13:30:00Z', 'REGULAR', 'Fri 30 Oct 09:30 EDT'],
    ['2026-11-02T14:29:59Z', 'PRE', 'Mon 2 Nov 09:29:59 EST, after the DST change'],
    ['2026-11-02T14:30:00Z', 'REGULAR', 'Mon 2 Nov 09:30 EST'],
    ['2026-11-26T15:00:00Z', 'HOLIDAY', 'Thanksgiving'],
    ['2026-11-27T17:59:59Z', 'REGULAR', 'Fri 27 Nov 12:59:59 EST, early-close day'],
    ['2026-11-27T18:00:00Z', 'POST', 'Fri 27 Nov 13:00 EST, early close'],
  ])('%s is %s (%s)', (instant, state) => {
    expect(at(instant).state).toBe(state);
  });
});

describe('marketClock: reference age and session times', () => {
  it('is zero during the regular session', () => {
    expect(at('2026-09-25T15:00:00Z').referenceAgeSec).toBe(0);
  });

  it('counts from the Friday close through the weekend', () => {
    const clock = at('2026-09-26T10:12:00Z'); // Sat 06:12 ET
    expect(iso(clock.lastClose)).toBe('2026-09-25T20:00:00.000Z');
    expect(clock.referenceAgeSec).toBe(14 * 3600 + 12 * 60);
    expect(iso(clock.nextOpen)).toBe('2026-09-28T13:30:00.000Z');
    expect(iso(clock.nextClose)).toBe('2026-09-28T20:00:00.000Z');
  });

  it('reaches 65.5 hours just before the Monday open', () => {
    const clock = at('2026-09-28T13:29:00Z');
    expect(clock.referenceAgeSec).toBe(65 * 3600 + 29 * 60);
    expect(iso(clock.nextOpen)).toBe('2026-09-28T13:30:00.000Z');
  });

  it('points at the next day once the session has closed', () => {
    const clock = at('2026-09-28T21:00:00Z'); // Mon 17:00 ET
    expect(iso(clock.lastClose)).toBe('2026-09-28T20:00:00.000Z');
    expect(clock.referenceAgeSec).toBe(3600);
    expect(iso(clock.nextOpen)).toBe('2026-09-29T13:30:00.000Z');
  });

  it('skips a holiday and honours the early close after it', () => {
    const clock = at('2026-11-26T15:00:00Z'); // Thanksgiving
    expect(iso(clock.lastClose)).toBe('2026-11-25T21:00:00.000Z');
    expect(iso(clock.nextOpen)).toBe('2026-11-27T14:30:00.000Z');
    expect(iso(clock.nextClose)).toBe('2026-11-27T18:00:00.000Z');
  });

  it('crosses the DST change: Friday close in EDT, Monday open in EST', () => {
    const clock = at('2026-11-01T12:00:00Z'); // Sun 07:00 EST
    expect(iso(clock.lastClose)).toBe('2026-10-30T20:00:00.000Z');
    expect(iso(clock.nextOpen)).toBe('2026-11-02T14:30:00.000Z');
  });
});
