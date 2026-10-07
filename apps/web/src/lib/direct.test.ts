import type { Gathered } from '@oneticker/clients';
import { instruments, type RouteVenueInput } from '@oneticker/core';
import { describe, expect, it } from 'vitest';
import { directEnabled, toViewInput } from './direct';
import { buildView } from './view';

const nvda = instruments.find((i) => i.ticker === 'NVDA')!;
const SAT = new Date('2026-10-03T12:00:00.000Z'); // US market closed for the weekend
const WED = new Date('2026-10-07T15:00:00.000Z'); // regular session

const venue = (over: Partial<RouteVenueInput> = {}): RouteVenueInput => ({
  issuer: 'bstocks',
  symbol: 'NVDAB',
  address: '0x02fca66c1d1afb4e2a7884261eb00f63598a7436',
  shareRatio: 1,
  onchainPx: 240,
  onchainAt: new Date('2026-10-03T11:55:00.000Z'),
  execPxAtAmount: 242,
  execPxAt100: 242,
  quoteVendor: 'LiquidMesh',
  quoteError: null,
  oraclePxAtToken: 240.2,
  oracleAt: new Date('2026-10-03T11:30:00.000Z'),
  multiplierPending: false,
  halted: false,
  ...over,
});
const gathered = (over: Partial<Gathered> = {}): Gathered => ({ venues: [venue()], referenceSep: 240, referenceSource: 'binance-derived', perpSep: null, ...over });

describe('directEnabled', () => {
  it('needs both keys, and stays off during the production build', () => {
    expect(directEnabled({})).toBe(false);
    expect(directEnabled({ BINANCE_WEB3_API_KEY: 'k' })).toBe(false);
    expect(directEnabled({ BINANCE_WEB3_API_KEY: 'k', BINANCE_WEB3_API_SECRET: 's' })).toBe(true);
    expect(directEnabled({ BINANCE_WEB3_API_KEY: 'k', BINANCE_WEB3_API_SECRET: 's', NEXT_PHASE: 'phase-production-build' })).toBe(false);
  });
});

describe('toViewInput', () => {
  it('maps gathered surfaces to the view input, prices still per token, dates as milliseconds', () => {
    const input = toViewInput(nvda, gathered(), SAT, SAT);
    expect(input).toMatchObject({ ticker: 'NVDA', source: 'live', referenceSep: 240, perpSep: null });
    expect(input.venues[0]).toMatchObject({ issuer: 'bstocks', execPxToken: 242, onchainAt: Date.parse('2026-10-03T11:55:00.000Z'), oracleAt: Date.parse('2026-10-03T11:30:00.000Z'), quoteVendor: 'LiquidMesh' });
  });

  it('keeps a venue that could not quote as an exclusion with its error', () => {
    const v = buildView(toViewInput(nvda, gathered({ venues: [venue({ execPxAtAmount: null, quoteError: '40374' })] }), SAT, SAT)).venues[0]!;
    expect(v.quote).toMatchObject({ ok: false, code: '40374' });
    expect(v.gate).toBeNull();
  });

  it('feeds the perp to the gate while the market is closed, and says nothing about it during the session', () => {
    // 242 against a 240 perp is 83 bps over: PERP_DIVERGENCE on a closed weekend.
    const closed = buildView(toViewInput(nvda, gathered({ perpSep: 240 }), SAT, SAT)).venues[0]!;
    expect(closed.gate?.reasons.map((r) => r.code)).toContain('PERP_DIVERGENCE');
    const open = buildView(toViewInput(nvda, gathered({ perpSep: 240 }), WED, WED)).venues[0]!;
    expect(open.gate?.reasons.map((r) => r.code)).not.toContain('PERP_DIVERGENCE');
  });

  it('without a perp the verdict is what it was before the perp existed', () => {
    const withNull = buildView(toViewInput(nvda, gathered({ perpSep: null }), SAT, SAT)).venues[0]!;
    expect(withNull.gate?.reasons.map((r) => r.code)).not.toContain('PERP_DIVERGENCE');
  });
});
