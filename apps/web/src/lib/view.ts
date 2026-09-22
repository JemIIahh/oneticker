import { checkGate, exclusionReason, marketClock, type GateResult, type Issuer, type MarketClock } from '@oneticker/core';

export const ISSUER_LABEL: Record<Issuer, string> = { bstocks: 'bStocks', ondo: 'Ondo', xstocks: 'xStocks' };

/** One venue's raw facts, from whichever source (live Tape or fixtures). Prices are per raw token. */
export interface VenueInput {
  issuer: Issuer;
  symbol: string;
  address: string;
  shareRatio: number | null;
  onchainPx: number | null;
  onchainAt: number | null;
  /** What $100 buys, in USD per token; null when the venue refused to quote. */
  execPxToken: number | null;
  quoteVendor: string | null;
  quoteError: string | null;
  oraclePxToken: number | null;
  oracleAt: number | null;
  multiplierPending: boolean;
}

export interface VenueView {
  issuer: Issuer;
  label: string;
  symbol: string;
  address: string;
  shareRatio: number;
  onchainSep: number | null;
  onchainAgeSec: number | null;
  execSep: number | null;
  premiumBps: number | null;
  quote: { ok: true; vendor: string } | { ok: false; code: string; reason: string };
  oracle: { sep: number; ageSec: number } | null;
  gate: GateResult | null;
}

export interface InstrumentView {
  ticker: string;
  name: string;
  source: 'live' | 'fixtures';
  asOf: string;
  clock: MarketClock;
  referenceSep: number | null;
  referenceNote: string;
  venues: VenueView[];
}

export interface ViewInput {
  ticker: string;
  name: string;
  source: 'live' | 'fixtures';
  asOf: Date;
  now: Date;
  referenceSep: number | null;
  referenceNote: string;
  venues: VenueInput[];
}

const age = (now: Date, at: number | null) => (at === null ? null : Math.max(0, Math.floor((now.getTime() - at) / 1000)));

/** Turns raw per-token facts into per-share views with a gate verdict. Pure. */
export function buildView(input: ViewInput): InstrumentView {
  const clock = marketClock(input.now);
  const venues = input.venues.map((v): VenueView => {
    const shareRatio = v.shareRatio ?? 1;
    const onchainSep = v.onchainPx === null ? null : v.onchainPx / shareRatio;
    const execSep = v.execPxToken === null ? null : v.execPxToken / shareRatio;
    const oracle = v.oraclePxToken !== null && v.oracleAt !== null ? { sep: v.oraclePxToken / shareRatio, ageSec: age(input.now, v.oracleAt)! } : null;
    const premiumBps = execSep !== null && input.referenceSep !== null ? (execSep / input.referenceSep - 1) * 10_000 : null;
    const quote: VenueView['quote'] =
      execSep !== null ? { ok: true, vendor: v.quoteVendor ?? 'the aggregator' } : { ok: false, code: v.quoteError ?? 'NO_QUOTE', reason: v.quoteError ? exclusionReason(v.quoteError).reason : 'No quote recorded yet' };
    const gate =
      execSep === null
        ? null
        : checkGate({
            side: 'buy',
            marketState: clock.state,
            referenceAgeSec: clock.referenceAgeSec,
            referenceSep: input.referenceSep,
            executableSep: execSep,
            executableSep100: execSep,
            oracleSep: oracle?.sep ?? null,
            oracleAgeSec: oracle?.ageSec ?? null,
            multiplierPending: v.multiplierPending,
            halted: false,
          });
    return { issuer: v.issuer, label: ISSUER_LABEL[v.issuer], symbol: v.symbol, address: v.address, shareRatio, onchainSep, onchainAgeSec: age(input.now, v.onchainAt), execSep, premiumBps, quote, oracle, gate };
  });
  return { ticker: input.ticker, name: input.name, source: input.source, asOf: input.asOf.toISOString(), clock, referenceSep: input.referenceSep, referenceNote: input.referenceNote, venues };
}
