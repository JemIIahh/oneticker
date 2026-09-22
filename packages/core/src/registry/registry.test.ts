import { describe, expect, it } from 'vitest';
import { instruments } from './index';

describe('registry', () => {
  it('holds exactly 5 instruments (scope cap)', () => {
    expect(instruments.map((i) => i.ticker)).toEqual(['NVDA', 'TSLA', 'QQQ', 'CRCL', 'MSTR']);
  });

  it('has at most one venue per issuer, with a valid address and a path matching the issuer', () => {
    const paths = { bstocks: 'RFQ_BSTOCK', ondo: 'RFQ_ONDO', xstocks: 'AMM' } as const;
    for (const instrument of instruments) {
      expect(new Set(instrument.venues.map((v) => v.issuer)).size).toBe(instrument.venues.length);
      for (const venue of instrument.venues) {
        expect(venue.address).toMatch(/^0x[0-9a-f]{40}$/);
        expect(venue.path).toBe(paths[venue.issuer]);
        expect(venue.symbol.startsWith(instrument.ticker)).toBe(true);
      }
    }
  });

  it('never reuses an address', () => {
    const addresses = instruments.flatMap((i) => i.venues.map((v) => v.address));
    expect(new Set(addresses).size).toBe(addresses.length);
  });
});
