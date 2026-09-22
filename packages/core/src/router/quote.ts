import { bps, checkGate, type GateResult } from '../gate';
import { marketClock, type MarketClock } from '../market';
import type { Issuer } from '../registry';
import { exclusionReason } from './exclusions';

/** One venue's already-fetched surfaces, in USD per raw token (not per share). Pure input: no I/O here. */
export interface RouteVenueInput {
  issuer: Issuer;
  symbol: string;
  address: string;
  /** Shares per raw token: BEP-677 uiMultiplier (bStocks), tokenPrice/referencePrice (Ondo), or 1 (xStocks). */
  shareRatio: number;
  onchainPx: number | null;
  onchainAt: Date | null;
  /** USD per raw token payable at the requested amount; null when the quote failed. */
  execPxAtAmount: number | null;
  /** USD per raw token payable at $100, the impact baseline (SPEC 3.4). Falls back to execPxAtAmount when amountUsd is 100. */
  execPxAt100: number | null;
  quoteVendor: string | null;
  /** The API error code when execPxAtAmount is null, e.g. '40374', '40369', 'NETWORK_ERROR'. */
  quoteError: string | null;
  oraclePxAtToken: number | null;
  oracleAt: Date | null;
  multiplierPending: boolean;
  halted: boolean;
}

export interface RouteOk {
  status: 'ok';
  issuer: Issuer;
  symbol: string;
  /** BSC contract address, from the registry: the `--toToken` / `--fromToken` for a swap. */
  address: string;
  /** Share-equivalent price at the requested amount. */
  sep: number;
  /** Shares per raw token used for `sep`, so a caller can convert its own token quote (e.g. from `baw`) to per share. */
  sharesPerToken: number;
  onchainSep: number | null;
  onchainAgeSec: number | null;
  /** vs the instrument's referenceSep; same raw formula on both sides, not side-adjusted (the gate's PREMIUM_HIGH rule is). */
  premiumBps: number | null;
  vendor: string | null;
  gate: GateResult;
}

export interface RouteExcluded {
  status: 'excluded';
  issuer: Issuer;
  symbol: string;
  code: string;
  reason: string;
}

export interface QuoteRouteInput {
  ticker: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  /** An independent share-equivalent reference price; null when none is available (SPEC: use Finnhub, not Binance's derived one). */
  referenceSep: number | null;
  venues: RouteVenueInput[];
  now?: Date;
}

export interface QuoteRouteResult {
  ticker: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  asOf: string;
  clock: MarketClock;
  referenceSep: number | null;
  /** Ranked best first: cheapest SEP to buy, richest SEP to sell. */
  routes: RouteOk[];
  excluded: RouteExcluded[];
}

const age = (now: Date, at: Date | null) => (at === null ? null : Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000)));

/**
 * quote_route (SPEC 3.6): every venue, ranked by net share-equivalent price, with a gate verdict per venue
 * and a plain-English reason for any venue an API error excluded. Pure: takes already-fetched surfaces,
 * does no I/O, and is deterministic for the same input.
 */
export function quoteRoute(input: QuoteRouteInput): QuoteRouteResult {
  const now = input.now ?? new Date();
  const clock = marketClock(now);
  const routes: RouteOk[] = [];
  const excluded: RouteExcluded[] = [];

  for (const v of input.venues) {
    if (v.execPxAtAmount === null) {
      const code = v.quoteError ?? 'NO_QUOTE';
      excluded.push({ status: 'excluded', issuer: v.issuer, symbol: v.symbol, code, reason: exclusionReason(code).reason });
      continue;
    }

    const sep = v.execPxAtAmount / v.shareRatio;
    const sep100 = (v.execPxAt100 ?? v.execPxAtAmount) / v.shareRatio;
    const onchainSep = v.onchainPx !== null ? v.onchainPx / v.shareRatio : null;
    const oracleSep = v.oraclePxAtToken !== null ? v.oraclePxAtToken / v.shareRatio : null;
    const oracleAgeSec = age(now, v.oracleAt);
    const premiumBps = input.referenceSep !== null ? bps(sep, input.referenceSep) : null;

    const gate = checkGate({
      side: input.side,
      marketState: clock.state,
      referenceAgeSec: clock.referenceAgeSec,
      referenceSep: input.referenceSep,
      executableSep: sep,
      executableSep100: sep100,
      oracleSep,
      oracleAgeSec,
      multiplierPending: v.multiplierPending,
      halted: v.halted,
    });

    routes.push({ status: 'ok', issuer: v.issuer, symbol: v.symbol, address: v.address, sep, sharesPerToken: v.shareRatio, onchainSep, onchainAgeSec: age(now, v.onchainAt), premiumBps, vendor: v.quoteVendor, gate });
  }

  routes.sort((a, b) => (input.side === 'buy' ? a.sep - b.sep : b.sep - a.sep));

  return { ticker: input.ticker, side: input.side, amountUsd: input.amountUsd, asOf: now.toISOString(), clock, referenceSep: input.referenceSep, routes, excluded };
}
