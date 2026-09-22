// Fallback data: the saved fixtures from 22 Sep 2026, used when the Tape API is not configured or unreachable.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { instruments, type Venue } from '@oneticker/core';
import { buildView, type InstrumentView, type VenueInput } from './view';

const FIXTURES = path.join(process.cwd(), '../../fixtures');

function latestFile(dir: string, prefix: string): string | null {
  try {
    return (
      readdirSync(path.join(FIXTURES, dir))
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
        .sort()
        .at(-1) ?? null
    );
  } catch {
    return null;
  }
}

function latest<T>(dir: string, prefix: string): T | null {
  const file = latestFile(dir, prefix);
  return file ? (JSON.parse(readFileSync(path.join(FIXTURES, dir, file), 'utf8')) as T) : null;
}

const stamp = (file: string | null) => file?.match(/(\d{8}T\d{6}Z)\.json$/)?.[1] ?? '';
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

interface Envelope<T> {
  data: T;
  timestamp: number;
}
interface RwaPriceItem {
  tokenContractAddress: string;
  tokenPrice: string;
  referencePrice: string;
  tokenPriceUpdatedAt: number;
}
interface MarketPriceItem {
  tokenContractAddress: string;
  price: string;
  time: number;
}
interface QuoteItem {
  vendorName: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  fromToken: { decimal: string };
  toToken: { decimal: string };
}

/** The newest recorded $100 quote for a venue: a price per token, or the error code the API returned. */
function quoteFor(venue: Venue): { pricePerToken: number; vendor: string } | { code: string } | null {
  const okFile = latestFile('web3', `aggregator-quote-${venue.symbol}-100usd-2026`);
  const errFile = latestFile('web3', `aggregator-quote-${venue.symbol}-100usd-error-`);
  if (okFile && stamp(okFile) >= stamp(errFile)) {
    const q = latest<Envelope<QuoteItem[]>>('web3', okFile.replace(/\.json$/, ''))?.data[0];
    if (q) {
      const from = Number(q.fromTokenAmount) / 10 ** Number(q.fromToken.decimal);
      const to = Number(q.toTokenAmount) / 10 ** Number(q.toToken.decimal);
      if (from > 0 && to > 0) return { pricePerToken: from / to, vendor: q.vendorName };
    }
  }
  const err = errFile ? latest<{ code: string }>('web3', errFile.replace(/\.json$/, '')) : null;
  return err ? { code: err.code } : null;
}

export function fixtureView(ticker: string, at?: Date): InstrumentView | null {
  const instrument = instruments.find((i) => i.ticker === ticker.toUpperCase());
  if (!instrument) return null;

  const rwa = latest<Envelope<RwaPriceItem[]>>('web3', 'rwa-price-2026');
  const market = latest<Envelope<MarketPriceItem[]>>('web3', 'market-price-2026');
  const asOf = new Date(market?.timestamp ?? rwa?.timestamp ?? Date.now());

  let referenceSep: number | null = null;
  for (const venue of instrument.venues) {
    const px = latest<{ data: { marketData: { referencePrice: string | null } } }>('web3', `rwa-underlying-market-${venue.symbol}-`)?.data.marketData.referencePrice;
    if (px) {
      referenceSep = Number(px);
      break;
    }
  }

  const venues = instrument.venues.map((venue): VenueInput => {
    const rwaItem = rwa?.data.find((i) => same(i.tokenContractAddress, venue.address));
    const marketItem = market?.data.find((i) => same(i.tokenContractAddress, venue.address));
    const bep = venue.issuer === 'bstocks' ? latest<{ multiplier: number; pending: unknown | null }>('chain', `bep677-${venue.symbol}-`) : null;
    const apro = venue.issuer === 'bstocks' ? latest<{ price: number; updatedAt: string }>('chain', `apro-${venue.symbol}-`) : null;
    const q = quoteFor(venue);
    return {
      issuer: venue.issuer,
      symbol: venue.symbol,
      address: venue.address,
      shareRatio: bep?.multiplier ?? (venue.issuer === 'ondo' && rwaItem ? Number(rwaItem.tokenPrice) / Number(rwaItem.referencePrice) : 1),
      onchainPx: rwaItem ? Number(rwaItem.tokenPrice) : marketItem ? Number(marketItem.price) : null,
      onchainAt: rwaItem?.tokenPriceUpdatedAt ?? marketItem?.time ?? null,
      execPxToken: q && 'pricePerToken' in q ? q.pricePerToken : null,
      quoteVendor: q && 'vendor' in q ? q.vendor : null,
      quoteError: q && 'code' in q ? q.code : null,
      oraclePxToken: apro?.price ?? null,
      oracleAt: apro ? Date.parse(apro.updatedAt) : null,
      multiplierPending: bep?.pending !== null && bep?.pending !== undefined,
    };
  });

  return buildView({
    ticker: instrument.ticker,
    name: instrument.name,
    source: 'fixtures',
    asOf,
    now: at ?? asOf,
    referenceSep,
    referenceNote: referenceSep === null ? 'no reference price recorded' : "Binance's underlying-market reference (derived from the token price; an independent quote replaces it)",
    venues,
  });
}
