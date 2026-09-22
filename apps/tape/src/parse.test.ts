import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { instruments } from '@oneticker/core';
import type { Captured } from './collect';
import { parseVenue, quotePrice } from './parse';

// Real responses from 22 Sep 2026 11:30 UTC (pre-market).
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../../fixtures/web3/${name}`, import.meta.url), 'utf8'));
const ok = (name: string): Captured => ({ at: 'x', ok: true, envelope: fixture(name) });
const error = (name: string): Captured => {
  const e = fixture(name) as { httpStatus: number; code: string; message: string; response: unknown };
  return { at: 'x', ok: false, httpStatus: e.httpStatus, code: e.code, message: e.message, response: e.response };
};

const rwaPrice = ok('rwa-price-20260922T113041Z.json');
const marketPrice = ok('market-price-20260922T113041Z.json');
const nvda = instruments.find((i) => i.ticker === 'NVDA')!;
const venue = (issuer: string) => nvda.venues.find((v) => v.issuer === issuer)!;
const quotes = (q: Captured) => ({ '100': q, '1000': q, '10000': q });

describe('parseVenue', () => {
  it('bStocks: on-chain price from rwa/price, executable price from the LiquidMesh quote', () => {
    const quote = ok('aggregator-quote-NVDAB-100usd-20260922T113043Z.json');
    const parsed = parseVenue(venue('bstocks'), { rwaPrice, marketPrice, quotes: quotes(quote) });
    expect(parsed.onchainPx).toBe(226.87);
    expect(parsed.onchainTs).toMatch(/^2026-09-22T11:3\d:\d\d\.\d{3}Z$/);
    expect(parsed.execPx['100']).toBeGreaterThan(225);
    expect(parsed.execPx['100']).toBeLessThan(229);
    expect(parsed.execPx['100']).toBe(quotePrice((quote as { envelope: { data: Parameters<typeof quotePrice>[0][] } }).envelope.data[0]!));
    expect(parsed.shareRatio).toBeNull(); // comes from the chain for bStocks
    expect(parsed.quoteErrors).toEqual({});
  });

  it('Ondo: share ratio derived from tokenPrice / referencePrice', () => {
    const parsed = parseVenue(venue('ondo'), { rwaPrice, marketPrice, quotes: quotes(ok('aggregator-quote-NVDAon-100usd-20260922T113046Z.json')) });
    expect(parsed.onchainPx).toBeCloseTo(227.1736, 4);
    expect(parsed.shareRatio).toBeCloseTo(1.0017152, 6);
    expect(parsed.execPx['100']).toBeGreaterThan(225);
    expect(parsed.execPx['100']).toBeLessThan(229);
  });

  it('xStocks: on-chain price from market/price, quote errors kept as codes', () => {
    const parsed = parseVenue(venue('xstocks'), { rwaPrice, marketPrice, quotes: quotes(error('aggregator-quote-NVDAx-100usd-error-20260922T113048Z.json')) });
    expect(parsed.onchainPx).toBeCloseTo(226.5654, 4);
    expect(parsed.onchainTs).toBe('2026-09-22T05:00:12.000Z');
    expect(parsed.execPx).toEqual({ '100': null, '1000': null, '10000': null });
    expect(parsed.quoteErrors).toEqual({ '100': '40374', '1000': '40374', '10000': '40374' });
  });

  it('survives missing surfaces', () => {
    const missing: Captured = { at: 'x', ok: false, httpStatus: 0, code: 'NO_API_KEYS', message: '', response: null };
    const parsed = parseVenue(venue('bstocks'), { rwaPrice: missing, marketPrice: null, quotes: { '100': missing } });
    expect(parsed).toEqual({ onchainPx: null, onchainTs: null, execPx: { '100': null, '1000': null, '10000': null }, shareRatio: null, quoteErrors: { '100': 'NO_API_KEYS' } });
  });
});

describe('quotePrice', () => {
  it('divides USDT in by tokens out using each token\'s decimals', () => {
    expect(quotePrice({ fromTokenAmount: '100000000000000000000', toTokenAmount: '440607829779975590', fromToken: { decimal: '18' }, toToken: { decimal: '18' }, vendorName: 'x', priceImpactPercent: '0' })).toBeCloseTo(226.959, 3);
    expect(quotePrice({ fromTokenAmount: '100000000', toTokenAmount: '0', fromToken: { decimal: '6' }, toToken: { decimal: '18' }, vendorName: 'x', priceImpactPercent: '0' })).toBeNull();
  });
});
