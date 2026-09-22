import { describe, expect, it } from 'vitest';
import { checkGate, defaultPolicy, formatDuration } from './gate';
import type { GateInput } from './types';

/** A clean weekday route: market open, every surface fresh and in line. */
const clean: GateInput = {
  side: 'buy',
  marketState: 'REGULAR',
  referenceAgeSec: 0,
  referenceSep: 226.74,
  executableSep: 226.8,
  executableSep100: 226.78,
  oracleSep: 226.75,
  oracleAgeSec: 600,
  multiplierPending: false,
  halted: false,
};

const codes = (input: GateInput) => checkGate(input).reasons.map((r) => r.code);

/** Moves the executable price with the $100 quote and the oracle, so only the premium rule can fire. */
const execAt = (sep: number, rest: Partial<GateInput> = {}): GateInput => ({ ...clean, executableSep: sep, executableSep100: sep, oracleSep: sep, ...rest });

describe('checkGate', () => {
  it('returns GO with no reasons on a clean route', () => {
    expect(checkGate(clean)).toEqual({ verdict: 'GO', reasons: [], policy: 'default@1' });
  });

  it('is deterministic', () => {
    expect(checkGate(clean)).toEqual(checkGate({ ...clean }));
  });

  it('REF_STALE: caution over 1h while closed, never on its own a block', () => {
    const stale = { ...clean, marketState: 'WEEKEND' as const, referenceAgeSec: 38 * 3600 + 12 * 60 };
    const result = checkGate(stale);
    expect(result.verdict).toBe('CAUTION');
    expect(result.reasons).toEqual([{ code: 'REF_STALE', detail: 'Reference price is 38h 12m old (US market weekend)' }]);
    expect(checkGate({ ...stale, referenceAgeSec: 100 * 3600 }).verdict).toBe('CAUTION');
  });

  it('REF_STALE: age is ignored during the regular session', () => {
    expect(codes({ ...clean, referenceAgeSec: 2 * 3600 })).toEqual([]);
  });

  it('REF_MISSING: caution when there is no reference at all', () => {
    expect(checkGate({ ...clean, referenceSep: null })).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'REF_MISSING' }] });
  });

  it('PREMIUM_HIGH: caution over 75 bps, block over 200 bps', () => {
    expect(checkGate(execAt(226.74 * 1.0076))).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'PREMIUM_HIGH', detail: 'Paying 76 bps over the last reference price' }] });
    expect(checkGate(execAt(226.74 * 1.0201))).toMatchObject({ verdict: 'BLOCK', reasons: [{ code: 'PREMIUM_HIGH' }] });
    expect(codes(execAt(226.74 * 1.0074))).toEqual([]);
  });

  it('PREMIUM_HIGH: a discount is fine for a buyer and adverse for a seller', () => {
    expect(codes(execAt(226.74 * 0.99))).toEqual([]);
    expect(checkGate(execAt(226.74 * 0.99, { side: 'sell' }))).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'PREMIUM_HIGH', detail: 'Receiving 100 bps under the last reference price' }] });
  });

  it('ORACLE_STALE: caution over the heartbeat, block over twice it', () => {
    expect(checkGate({ ...clean, oracleAgeSec: 3601 })).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'ORACLE_STALE', detail: 'Oracle last updated 1h 00m ago' }] });
    expect(checkGate({ ...clean, oracleAgeSec: 7201 })).toMatchObject({ verdict: 'BLOCK' });
  });

  it('ORACLE_DIVERGENCE: caution over 100 bps, block over 300 bps, either direction', () => {
    expect(checkGate({ ...clean, oracleSep: 226.8 / 1.0101 })).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'ORACLE_DIVERGENCE', detail: 'Executable price is 101 bps away from the oracle' }] });
    expect(checkGate({ ...clean, oracleSep: 226.8 * 1.032 })).toMatchObject({ verdict: 'BLOCK', reasons: [{ code: 'ORACLE_DIVERGENCE' }] });
  });

  it('ORACLE rules are skipped when the venue has no oracle', () => {
    expect(codes({ ...clean, oracleSep: null, oracleAgeSec: null, executableSep: clean.executableSep })).toEqual([]);
  });

  it('IMPACT_HIGH: caution over 50 bps, block over 150 bps versus the $100 quote', () => {
    const base = { ...clean, referenceSep: null, oracleSep: null, oracleAgeSec: null }; // isolate the rule
    expect(checkGate({ ...base, executableSep: 226.78 * 1.0051 }).reasons.map((r) => r.code)).toEqual(['REF_MISSING', 'IMPACT_HIGH']);
    expect(checkGate({ ...base, executableSep: 226.78 * 1.0151 }).verdict).toBe('BLOCK');
  });

  it('MULTIPLIER_PENDING is a caution and VENUE_HALTED a block', () => {
    expect(checkGate({ ...clean, multiplierPending: true })).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'MULTIPLIER_PENDING' }] });
    expect(checkGate({ ...clean, halted: true })).toMatchObject({ verdict: 'BLOCK', reasons: [{ code: 'VENUE_HALTED' }] });
  });

  it('lists every rule that fired, worst first, and takes the worst as the verdict', () => {
    const result = checkGate({ ...clean, marketState: 'WEEKEND', referenceAgeSec: 40 * 3600, oracleAgeSec: 8000, multiplierPending: true });
    expect(result.verdict).toBe('BLOCK');
    expect(result.reasons.map((r) => r.code)).toEqual(['ORACLE_STALE', 'MULTIPLIER_PENDING', 'REF_STALE']);
  });

  it('weekend fixture: Saturday NVDAB with real 22 Sep numbers produces CAUTION', () => {
    // Friday 25 Sep 20:00 UTC close; Saturday 26 Sep 10:12 UTC. Reference = last close SEP. APRO answer 226.92509 per
    // token / uiMultiplier 1.000778 = 226.75 per share, heartbeat alive (40 min old). PancakeSwap trading 0.9% up.
    const saturday: GateInput = {
      side: 'buy',
      marketState: 'WEEKEND',
      referenceAgeSec: 14 * 3600 + 12 * 60,
      referenceSep: 226.74,
      executableSep: 228.78,
      executableSep100: 228.7,
      oracleSep: 226.92509 / 1.0007782237528078,
      oracleAgeSec: 40 * 60,
      multiplierPending: false,
      halted: false,
    };
    const result = checkGate(saturday);
    expect(result.verdict).toBe('CAUTION');
    expect(result.reasons).toEqual([
      { code: 'REF_STALE', detail: 'Reference price is 14h 12m old (US market weekend)' },
      { code: 'PREMIUM_HIGH', detail: 'Paying 90 bps over the last reference price' },
    ]);
    // The same route with the oracle dead since Friday night is a BLOCK.
    expect(checkGate({ ...saturday, oracleAgeSec: 11 * 3600 + 32 * 60 }).verdict).toBe('BLOCK');
  });

  it('accepts a custom policy and reports its id', () => {
    const strict = { ...defaultPolicy, id: 'strict@1', premiumBps: { caution: 10, block: 20 } };
    expect(checkGate({ ...clean, executableSep: 226.74 * 1.0011 }, strict)).toMatchObject({ verdict: 'CAUTION', policy: 'strict@1' });
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [59, '0m'],
    [60, '1m'],
    [3600, '1h 00m'],
    [38 * 3600 + 12 * 60 + 30, '38h 12m'],
  ])('%d s is %s', (sec, text) => {
    expect(formatDuration(sec)).toBe(text);
  });
});
