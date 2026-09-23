import { describe, expect, it } from 'vitest';
import { buildView, type VenueInput } from './view';

const venue = (o: Partial<VenueInput>): VenueInput => ({
  issuer: 'ondo',
  symbol: 'NVDAon',
  address: '0x',
  shareRatio: 1.0017152487959898,
  onchainPx: 229.3,
  onchainAt: null,
  execPxToken: 229.3,
  quoteVendor: 'LiquidMesh',
  quoteError: null,
  oraclePxToken: null,
  oracleAt: null,
  multiplierPending: false,
  ...o,
});
const view = (v: VenueInput) =>
  buildView({ ticker: 'NVDA', name: 'NVIDIA', source: 'live', asOf: new Date('2026-09-23T07:30:00Z'), now: new Date('2026-09-23T07:30:00Z'), referenceSep: null, referenceNote: '', venues: [v] }).venues[0]!;

describe('buildView share ratios', () => {
  it('divides by the known ratio', () => {
    expect(view(venue({})).execSep).toBeCloseTo(229.3 / 1.0017152487959898, 9);
  });

  it('excludes an Ondo or bStocks venue whose ratio is unknown, rather than assuming 1', () => {
    const v = view(venue({ shareRatio: null }));
    expect(v.execSep).toBeNull();
    expect(v.onchainSep).toBeNull();
    expect(v.gate).toBeNull();
    expect(v.quote).toMatchObject({ ok: false, code: 'NO_SHARE_RATIO' });
  });

  it('keeps the quote error when the venue did not quote at all', () => {
    expect(view(venue({ shareRatio: null, execPxToken: null, quoteError: '40374' })).quote).toMatchObject({ ok: false, code: '40374' });
  });

  it('treats xStocks as 1:1 when no ratio is recorded', () => {
    expect(view(venue({ issuer: 'xstocks', symbol: 'NVDAx', shareRatio: null, execPxToken: 226.5 })).execSep).toBe(226.5);
  });
});
