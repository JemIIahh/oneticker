import type { Instrument, Venue } from './types';

/** Other names people use for the 5 instruments. Lowercase, punctuation stripped. */
const ALIASES: Record<string, string> = {
  nvidia: 'US:NVDA',
  tesla: 'US:TSLA',
  qqq: 'US:QQQ',
  nasdaq: 'US:QQQ',
  nasdaq100: 'US:QQQ',
  invesco: 'US:QQQ',
  circle: 'US:CRCL',
  usdc: 'US:CRCL',
  strategy: 'US:MSTR',
  microstrategy: 'US:MSTR',
};

export interface Resolution {
  instrument: Instrument;
  /** Set when the query named one issuer's token (a symbol or an address), not just the stock. */
  venue: Venue | null;
  matchedOn: 'ticker' | 'id' | 'symbol' | 'address' | 'name' | 'alias';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9:]/g, '');

/**
 * Bare ticker, company name, instrument id, issuer token symbol or contract address to one instrument.
 * Returns null rather than guessing between instruments; the registry is small enough that a miss is a real miss.
 */
export function resolveInstrument(instruments: readonly Instrument[], query: string): Resolution | null {
  const raw = query.trim();
  if (!raw) return null;

  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    const address = raw.toLowerCase();
    for (const instrument of instruments) {
      const venue = instrument.venues.find((v) => v.address.toLowerCase() === address);
      if (venue) return { instrument, venue, matchedOn: 'address' };
    }
    return null;
  }

  const q = norm(raw);
  for (const instrument of instruments) {
    if (norm(instrument.ticker) === q) return { instrument, venue: null, matchedOn: 'ticker' };
    if (norm(instrument.id) === q) return { instrument, venue: null, matchedOn: 'id' };
  }
  for (const instrument of instruments) {
    const venue = instrument.venues.find((v) => norm(v.symbol) === q);
    if (venue) return { instrument, venue, matchedOn: 'symbol' };
  }
  const aliasId = ALIASES[q];
  const byAlias = aliasId ? instruments.find((i) => i.id === aliasId) : undefined;
  if (byAlias) return { instrument: byAlias, venue: null, matchedOn: 'alias' };

  const byName = instruments.filter((i) => norm(i.name).startsWith(q) && q.length >= 3);
  if (byName.length === 1) return { instrument: byName[0]!, venue: null, matchedOn: 'name' };
  return null;
}
