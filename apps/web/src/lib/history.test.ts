import { describe, expect, it } from 'vitest';
import { closedStretches, toPoints } from './history';

describe('toPoints', () => {
  it('converts every surface to per share and keeps the cheapest quote', () => {
    const rows = [
      { ts: '2026-09-23T07:00:00.000Z', venue: 'bstocks', exec_px_100: 229.1, share_ratio: 1.0007782237528078, pool_px: 228.9 },
      { ts: '2026-09-23T07:00:00.000Z', venue: 'ondo', exec_px_100: 229.3, share_ratio: 1.0017152487959898, pool_px: null },
      { ts: '2026-09-23T07:00:00.000Z', venue: 'xstocks', exec_px_100: null, share_ratio: 1, pool_px: null },
    ];
    const [p] = toPoints(rows, [{ ts: '2026-09-23T07:00:00.000Z', perp_mark_px: 229.2 }]);
    expect(p!.pool).toBeCloseTo(228.9 / 1.0007782237528078, 9);
    expect(p!.quote).toBeCloseTo(Math.min(229.1 / 1.0007782237528078, 229.3 / 1.0017152487959898), 9);
    expect(p!.perp).toBe(229.2);
  });

  it('skips a venue whose share ratio is unknown instead of assuming 1', () => {
    const rows = [{ ts: '2026-09-23T07:05:00.000Z', venue: 'ondo', exec_px_100: 200, share_ratio: null, pool_px: null }];
    expect(toPoints(rows, [])).toEqual([]);
  });

  it('orders runs by time', () => {
    const u = [
      { ts: '2026-09-23T07:10:00.000Z', perp_mark_px: 2 },
      { ts: '2026-09-23T07:05:00.000Z', perp_mark_px: 1 },
    ];
    expect(toPoints([], u).map((p) => p.perp)).toEqual([1, 2]);
  });
});

describe('closedStretches', () => {
  it('marks Friday close to Monday open as one closed stretch', () => {
    const from = Date.parse('2026-09-25T19:00:00Z'); // Fri 15:00 ET, open
    const to = Date.parse('2026-09-28T14:00:00Z'); // Mon 10:00 ET, open
    expect(closedStretches(from, to)).toEqual([[Date.parse('2026-09-25T20:00:00Z'), Date.parse('2026-09-28T13:30:00Z')]]);
  });

  it('runs a stretch to the end of the window when still closed', () => {
    const from = Date.parse('2026-09-23T07:00:00Z');
    const to = Date.parse('2026-09-23T08:00:00Z');
    expect(closedStretches(from, to)).toEqual([[from, to]]);
  });
});
