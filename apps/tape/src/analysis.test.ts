import { describe, expect, it } from 'vitest';
import { analyze, groupOf, quantile, quantiles, sep, series, type Sample, type VenueSample } from './analysis';

const SAT = '2026-10-03T12:00:00.000Z';
const WED_NIGHT = '2026-09-30T22:00:00.000Z';
const THU_OPEN = '2026-10-01T15:00:00.000Z';

function venue(over: Partial<VenueSample> & { px?: number } = {}): VenueSample {
  const px = over.px ?? null;
  return { ratio: 1, exec: { '100': px, '1k': px, '10k': px }, pool: null, oraclePx: null, oracleUpdatedAt: null, ...over };
}
const sample = (ts: string, venues: Sample['venues'], perp: number | null = null, instrument = 'US:NVDA'): Sample => ({ ts, instrument, perp, venues });

describe('groupOf', () => {
  it('splits open, weeknight and weekend from the market clock', () => {
    expect(groupOf(THU_OPEN)).toBe('open');
    expect(groupOf(WED_NIGHT)).toBe('weeknight');
    expect(groupOf(SAT)).toBe('weekend');
    expect(groupOf('2026-10-05T10:00:00.000Z')).toBe('weekend'); // Monday pre-market, still inside the weekend gap
    expect(groupOf('2026-10-02T21:00:00.000Z')).toBe('weekend'); // an hour after Friday's close
  });
});

describe('quantiles', () => {
  it('uses nearest rank and tolerates empty input', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({ n: 10, mean: 5.5, p10: 2, p50: 6, p90: 10 });
  });
});

describe('sep', () => {
  it('divides by the ratio and refuses a missing or zero one', () => {
    expect(sep(110, 1.1)).toBeCloseTo(100);
    expect(sep(110, null)).toBeNull();
    expect(sep(110, 0)).toBeNull();
    expect(sep(null, 1)).toBeNull();
  });
});

describe('analyze', () => {
  it('measures the issuer gap against the cheaper price and counts the cheapest issuer', () => {
    const s = sample(SAT, { bstocks: venue({ px: 100 }), ondo: venue({ px: 101 }) });
    const f = analyze([s], 1);
    expect(f.issuerSpread['100'].weekend).toMatchObject({ n: 1, bstocksCheapest: 1, ondoOver10pct: 0 });
    expect(f.issuerSpread['100'].weekend.regretBstocks.p50).toBe(0);
    expect(f.issuerSpread['100'].weekend.regretOndo.p50).toBeCloseTo(100, 6);
    expect(f.issuerSpread['100'].open.n).toBe(0);
  });

  it('puts the pool against the perp, per share', () => {
    const s = sample(SAT, { bstocks: venue({ ratio: 1.01, pool: 101 * 1.01 }) }, 100);
    const f = analyze([s], 1);
    expect(f.poolVsPerp.weekend.p50).toBeCloseTo(100, 6);
    expect(f.poolVsPerp.weekend.beyondPremiumCaution).toBe(1);
    expect(f.poolVsPerp.weekend.maxAbs).toBeCloseTo(100, 6);
  });

  it('reads the oracle against the perp and its age in minutes', () => {
    const s = sample(SAT, { bstocks: venue({ oraclePx: 99, oracleUpdatedAt: '2026-10-03T11:30:00.000Z' }) }, 100);
    const f = analyze([s], 1);
    expect(f.oracleVsPerp.weekend.p50).toBeCloseTo(-100, 6);
    expect(f.oracleAgeMin.weekend.p50).toBe(30);
  });

  it('replays the shipped gate on the cheapest $1,000 route with the perp as a live reference', () => {
    const calm = sample(SAT, { bstocks: venue({ px: 100, oraclePx: 100, oracleUpdatedAt: '2026-10-03T11:50:00.000Z' }) }, 100);
    const rich = sample(SAT, { bstocks: venue({ px: 103, oraclePx: 100, oracleUpdatedAt: '2026-10-03T11:50:00.000Z', exec: { '100': 100, '1k': 103, '10k': 103 } }) }, 100);
    const f = analyze([calm, rich], 2);
    expect(f.gateReplay.weekend.n).toBe(2);
    expect(f.gateReplay.weekend.verdicts.GO).toBe(1);
    expect(f.gateReplay.weekend.verdicts.BLOCK).toBe(1); // 300 bps over the perp and over the oracle
    expect(f.gateReplay.weekend.reasons.PREMIUM_HIGH).toBe(1);
  });

  it('skips the replay when there is no perp or no quote', () => {
    const f = analyze([sample(SAT, { bstocks: venue({ px: 100 }) }, null), sample(SAT, { bstocks: venue() }, 100)], 2);
    expect(f.gateReplay.weekend.n).toBe(0);
  });

  it('flags an issuer that charges over 10% more than the cheaper one', () => {
    const s = sample(THU_OPEN, { bstocks: venue({ px: 100 }), ondo: venue({ px: 125 }) });
    const f = analyze([s], 1);
    expect(f.issuerSpread['100'].open.ondoOver10pct).toBe(1);
    expect(f.issuerSpread['100'].open.regretBstocks.mean).toBe(0);
  });

  it('counts how often the reference-age rule alone fires while closed', () => {
    const f = analyze([sample(SAT, {}), sample(THU_OPEN, {})], 2);
    expect(f.refStaleShareClosed).toBe(1);
  });
});

describe('series', () => {
  it('averages per bucket and keeps the cheapest $100 quote per share', () => {
    const a = sample('2026-10-03T12:01:00.000Z', { bstocks: venue({ px: 102 }), ondo: venue({ px: 100 }) }, 100);
    const b = sample('2026-10-03T12:11:00.000Z', { bstocks: venue({ px: 104 }) }, 102);
    const pts = series([a, b], 'US:NVDA', 30);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.perp).toBe(101);
    expect(pts[0]!.quote).toBe(102); // mean of 100 (cheapest of the two) and 104
    expect(series([a], 'US:TSLA', 30)).toEqual([]);
  });
});
