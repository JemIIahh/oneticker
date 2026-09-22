import { describe, expect, it } from 'vitest';
import { bps } from '../gate';
import { quoteRoute, type RouteVenueInput } from './quote';

const NOW = new Date('2026-09-22T14:00:00.000Z'); // Tuesday, regular session

const venue = (over: Partial<RouteVenueInput> & Pick<RouteVenueInput, 'issuer' | 'symbol'>): RouteVenueInput => ({
  address: `0x${over.symbol.toLowerCase()}`,
  shareRatio: 1,
  onchainPx: null,
  onchainAt: null,
  execPxAtAmount: null,
  execPxAt100: null,
  quoteVendor: null,
  quoteError: null,
  oraclePxAtToken: null,
  oracleAt: null,
  multiplierPending: false,
  halted: false,
  ...over,
});

describe('quoteRoute', () => {
  it('ranks a buy by cheapest share-equivalent price first', () => {
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'buy',
      amountUsd: 500,
      referenceSep: 226.7,
      now: NOW,
      venues: [
        venue({ issuer: 'ondo', symbol: 'NVDAon', execPxAtAmount: 227.33, shareRatio: 1.001715, quoteVendor: 'LiquidMesh' }),
        venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 227.02, shareRatio: 1.000778, quoteVendor: 'LiquidMesh' }),
      ],
    });
    expect(result.routes.map((r) => r.symbol)).toEqual(['NVDAB', 'NVDAon']);
    expect(result.routes[0]!.sep).toBeCloseTo(227.02 / 1.000778, 4);
    expect(result.excluded).toEqual([]);
  });

  it('ranks a sell by richest share-equivalent price first', () => {
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'sell',
      amountUsd: 500,
      referenceSep: 226.7,
      now: NOW,
      venues: [
        venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 226.5, shareRatio: 1 }),
        venue({ issuer: 'ondo', symbol: 'NVDAon', execPxAtAmount: 226.9, shareRatio: 1 }),
      ],
    });
    expect(result.routes.map((r) => r.symbol)).toEqual(['NVDAon', 'NVDAB']);
  });

  it('excludes a venue with no quote and maps a known error code to its reason', () => {
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'buy',
      amountUsd: 100,
      referenceSep: 226.7,
      now: NOW,
      venues: [venue({ issuer: 'xstocks', symbol: 'NVDAx', execPxAtAmount: null, quoteError: '40374' })],
    });
    expect(result.routes).toEqual([]);
    expect(result.excluded).toEqual([{ status: 'excluded', issuer: 'xstocks', symbol: 'NVDAx', code: '40374', reason: 'No liquidity from any vendor right now' }]);
  });

  it('surfaces an unknown error code verbatim instead of hiding it', () => {
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'buy',
      amountUsd: 100,
      referenceSep: null,
      now: NOW,
      venues: [venue({ issuer: 'ondo', symbol: 'NVDAon', execPxAtAmount: null, quoteError: '40304' })],
    });
    expect(result.excluded[0]!.reason).toBe('Blocked in this region (Binance compliance restriction)');
  });

  it('defaults a missing error code to NO_QUOTE', () => {
    const result = quoteRoute({ ticker: 'NVDA', side: 'buy', amountUsd: 100, referenceSep: null, now: NOW, venues: [venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: null })] });
    expect(result.excluded[0]).toMatchObject({ code: 'NO_QUOTE' });
  });

  it('wires the gate through unmodified: CAUTION on a missing reference', () => {
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'buy',
      amountUsd: 100,
      referenceSep: null,
      now: NOW,
      venues: [venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 227 })],
    });
    expect(result.routes[0]!.gate).toMatchObject({ verdict: 'CAUTION', reasons: [{ code: 'REF_MISSING' }] });
  });

  it('falls back the impact baseline to execPxAtAmount when only one quote was fetched (amountUsd === 100)', () => {
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'buy',
      amountUsd: 100,
      referenceSep: 227,
      now: NOW,
      venues: [venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 227.5, execPxAt100: null })],
    });
    expect(result.routes[0]!.gate.reasons.some((r) => r.code === 'IMPACT_HIGH')).toBe(false);
  });

  it('premiumBps is the raw bps formula, not side-adjusted', () => {
    const buy = quoteRoute({ ticker: 'NVDA', side: 'buy', amountUsd: 100, referenceSep: 100, now: NOW, venues: [venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 101 })] });
    const sell = quoteRoute({ ticker: 'NVDA', side: 'sell', amountUsd: 100, referenceSep: 100, now: NOW, venues: [venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 101 })] });
    expect(buy.routes[0]!.premiumBps).toBeCloseTo(bps(101, 100), 6);
    expect(sell.routes[0]!.premiumBps).toBe(buy.routes[0]!.premiumBps);
  });

  it('reports onchain price and age per share', () => {
    const at = new Date(NOW.getTime() - 90_000);
    const result = quoteRoute({
      ticker: 'NVDA',
      side: 'buy',
      amountUsd: 100,
      referenceSep: null,
      now: NOW,
      venues: [venue({ issuer: 'bstocks', symbol: 'NVDAB', execPxAtAmount: 227, onchainPx: 226.9, onchainAt: at, shareRatio: 1.000778 })],
    });
    expect(result.routes[0]!.onchainSep).toBeCloseTo(226.9 / 1.000778, 4);
    expect(result.routes[0]!.onchainAgeSec).toBe(90);
  });

  it('defaults now to the current time and still returns a valid clock', () => {
    const result = quoteRoute({ ticker: 'NVDA', side: 'buy', amountUsd: 100, referenceSep: null, venues: [] });
    expect(new Date(result.asOf).getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(result.clock.state).toBeDefined();
  });
});
