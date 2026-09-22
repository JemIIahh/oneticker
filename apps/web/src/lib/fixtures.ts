// T6: the shell renders from saved fixtures so UI work never waits on the backend. T13 swaps this for the live core.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkGate, exclusionReason, instruments, marketClock, type GateResult, type Instrument, type Issuer, type MarketClock, type Venue } from '@oneticker/core';

const FIXTURES = path.join(process.cwd(), '../../fixtures');

function latestFile(dir: string, prefix: string): string | null {
  return (
    readdirSync(path.join(FIXTURES, dir))
      .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
      .sort()
      .at(-1) ?? null
  );
}

function latest<T>(dir: string, prefix: string): T | null {
  const file = latestFile(dir, prefix);
  return file ? (JSON.parse(readFileSync(path.join(FIXTURES, dir, file), 'utf8')) as T) : null;
}

/** The UTC stamp at the end of a fixture name, for ordering an ok fixture against an error one. */
const stamp = (file: string | null) => file?.match(/(\d{8}T\d{6}Z)\.json$/)?.[1] ?? '';

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
interface QuoteError {
  code: string;
}
interface UnderlyingMarket {
  data: { marketData: { referencePrice: string | null } };
}
interface AproFixture {
  price: number;
  updatedAt: string;
}
interface Bep677Fixture {
  multiplier: number;
  pending: { multiplier: number; effectiveAt: string } | null;
}

export const ISSUER_LABEL: Record<Issuer, string> = { bstocks: 'bStocks', ondo: 'Ondo', xstocks: 'xStocks' };

export interface VenueView {
  issuer: Issuer;
  label: string;
  symbol: string;
  address: string;
  /** Shares per raw token. */
  shareRatio: number;
  /** Last on-chain price per share. */
  onchainSep: number | null;
  onchainAgeSec: number | null;
  /** Price per share you would actually pay for $100. */
  execSep: number | null;
  premiumBps: number | null;
  quote: { ok: true; vendor: string } | { ok: false; code: string; reason: string };
  oracle: { sep: number; ageSec: number } | null;
  gate: GateResult | null;
}

export interface InstrumentView {
  ticker: string;
  name: string;
  asOf: string;
  clock: MarketClock;
  referenceSep: number | null;
  referenceNote: string;
  venues: VenueView[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

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
  const err = errFile ? latest<QuoteError>('web3', errFile.replace(/\.json$/, '')) : null;
  return err ? { code: err.code } : null;
}

export function listInstruments(): Instrument[] {
  return [...instruments];
}

/** Builds the instrument page model from the newest fixtures. `at` overrides "now" so closed-market states can be previewed. */
export function loadInstrument(ticker: string, at?: Date): InstrumentView | null {
  const instrument = instruments.find((i) => i.ticker === ticker.toUpperCase());
  if (!instrument) return null;

  const rwa = latest<Envelope<RwaPriceItem[]>>('web3', 'rwa-price-2026');
  const market = latest<Envelope<MarketPriceItem[]>>('web3', 'market-price-2026');
  const asOf = new Date(market?.timestamp ?? rwa?.timestamp ?? Date.now());
  const now = at ?? asOf;
  const clock = marketClock(now);

  // No independent equity feed yet (needs a Finnhub key): use Binance's underlying-market reference when it has one.
  let referenceSep: number | null = null;
  for (const venue of instrument.venues) {
    const um = latest<UnderlyingMarket>('web3', `rwa-underlying-market-${venue.symbol}-`);
    const px = um?.data.marketData.referencePrice;
    if (px) {
      referenceSep = Number(px);
      break;
    }
  }

  const venues: VenueView[] = instrument.venues.map((venue) => {
    const rwaItem = rwa?.data.find((i) => same(i.tokenContractAddress, venue.address));
    const marketItem = market?.data.find((i) => same(i.tokenContractAddress, venue.address));
    const bep = venue.issuer === 'bstocks' ? latest<Bep677Fixture>('chain', `bep677-${venue.symbol}-`) : null;
    const apro = venue.issuer === 'bstocks' ? latest<AproFixture>('chain', `apro-${venue.symbol}-`) : null;

    const shareRatio = bep?.multiplier ?? (venue.issuer === 'ondo' && rwaItem ? Number(rwaItem.tokenPrice) / Number(rwaItem.referencePrice) : 1);
    const onchainPx = rwaItem ? Number(rwaItem.tokenPrice) : marketItem ? Number(marketItem.price) : null;
    const onchainAt = rwaItem?.tokenPriceUpdatedAt ?? marketItem?.time ?? null;
    const onchainSep = onchainPx === null ? null : onchainPx / shareRatio;

    const q = quoteFor(venue);
    const execSep = q && 'pricePerToken' in q ? q.pricePerToken / shareRatio : null;
    const quote: VenueView['quote'] =
      q && 'vendor' in q ? { ok: true, vendor: q.vendor } : q ? { ok: false, code: q.code, reason: exclusionReason(q.code).reason } : { ok: false, code: 'NO_QUOTE', reason: 'No quote recorded yet' };

    const oracle = apro ? { sep: apro.price / shareRatio, ageSec: Math.max(0, Math.floor((now.getTime() - Date.parse(apro.updatedAt)) / 1000)) } : null;
    const premiumBps = execSep !== null && referenceSep !== null ? (execSep / referenceSep - 1) * 10_000 : null;

    const gate =
      execSep === null
        ? null
        : checkGate({
            side: 'buy',
            marketState: clock.state,
            referenceAgeSec: clock.referenceAgeSec,
            referenceSep,
            executableSep: execSep,
            executableSep100: execSep,
            oracleSep: oracle?.sep ?? null,
            oracleAgeSec: oracle?.ageSec ?? null,
            multiplierPending: bep?.pending !== null && bep?.pending !== undefined,
            halted: false,
          });

    return {
      issuer: venue.issuer,
      label: ISSUER_LABEL[venue.issuer],
      symbol: venue.symbol,
      address: venue.address,
      shareRatio,
      onchainSep,
      onchainAgeSec: onchainAt === null ? null : Math.max(0, Math.floor((now.getTime() - onchainAt) / 1000)),
      execSep,
      premiumBps,
      quote,
      oracle,
      gate,
    };
  });

  return {
    ticker: instrument.ticker,
    name: instrument.name,
    asOf: asOf.toISOString(),
    clock,
    referenceSep,
    referenceNote: referenceSep === null ? 'No reference price recorded' : "Binance's underlying-market reference (an independent equity quote replaces this in T13)",
    venues,
  };
}
