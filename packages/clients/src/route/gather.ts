// Fetches every surface quote_route needs for one instrument: on-chain prices, aggregator quotes at the requested
// size and at $100, BEP-677 multipliers and APRO oracle readings. Shared by the CLI and the MCP server so both
// quote the same way. Every failure degrades to a per-venue exclusion or a null surface, never a thrown error.

import { isRwaVenue, type Instrument, type RouteVenueInput, type Venue } from '@oneticker/core';
import type { PublicClient } from 'viem';
import { APRO_FEEDS_BSC, readAproFeed, readMultiplier } from '../chain';
import { Web3ApiError, type Web3Client } from '../web3';

const BSC = '56';
export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD, 18 decimals

export interface GatherDeps {
  /** Null when no API keys are configured: every venue comes back excluded with NO_API_KEYS. */
  web3: Web3Client | null;
  chain: PublicClient;
  /** RFQ quotes for Ondo and xStocks need a wallet address (40001 otherwise). Public, not a secret. */
  quoteWallet?: string;
}

export interface GatherRequest {
  instrument: Instrument;
  side: 'buy' | 'sell';
  amountUsd: number;
}

export interface Gathered {
  venues: RouteVenueInput[];
  /** Binance's `referencePrice`: derived from the token price, not an independent quote (docs/RESEARCH.md item 1). */
  referenceSep: number | null;
  referenceSource: 'binance-derived' | null;
}

interface RwaItem {
  tokenContractAddress: string;
  tokenPrice: string;
  referencePrice: string;
  tokenPriceUpdatedAt: number;
}
interface MarketItem {
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

interface Onchain {
  px: Map<string, number>;
  refPx: Map<string, number>;
  at: Map<string, number>;
  referenceSep: number | null;
}

/** rwa/price (RWA venues, has referencePrice too) plus market/price (all venues, the only source for xStocks). */
async function fetchOnchain(web3: Web3Client | null, instrument: Instrument): Promise<Onchain> {
  const px = new Map<string, number>();
  const refPx = new Map<string, number>();
  const at = new Map<string, number>();
  let referenceSep: number | null = null;
  if (!web3) return { px, refPx, at, referenceSep };

  const rwaVenues = instrument.venues.filter(isRwaVenue);
  if (rwaVenues.length > 0) {
    try {
      const res = await web3.get<RwaItem[]>('/api/v1/dex/market/rwa/price', { binanceChainId: BSC, tokenContractAddresses: rwaVenues.map((v) => v.address).join(',') });
      for (const item of res.data) {
        const key = item.tokenContractAddress.toLowerCase();
        px.set(key, Number(item.tokenPrice));
        refPx.set(key, Number(item.referencePrice));
        at.set(key, item.tokenPriceUpdatedAt);
        if (referenceSep === null) referenceSep = Number(item.referencePrice);
      }
    } catch {
      // Left unset; the per-venue quote errors already explain the outage.
    }
  }
  try {
    const res = await web3.post<MarketItem[]>('/api/v1/dex/market/price', instrument.venues.map((v) => ({ binanceChainId: BSC, tokenContractAddress: v.address })));
    for (const item of res.data) {
      const key = item.tokenContractAddress.toLowerCase();
      if (!px.has(key)) {
        px.set(key, Number(item.price));
        at.set(key, item.time);
      }
    }
  } catch {
    // Same.
  }
  return { px, refPx, at, referenceSep };
}

/** One aggregator quote at `usd`. Direction follows `side`; a sell needs `onchainPx` to size the token amount. */
async function fetchQuote(
  deps: GatherDeps,
  venue: Venue,
  side: 'buy' | 'sell',
  onchainPx: number | undefined,
  usd: number,
): Promise<{ pxPerToken: number; vendor: string } | { code: string }> {
  if (!deps.web3) return { code: 'NO_API_KEYS' };
  const scale = 10n ** BigInt(venue.decimals);
  const toRaw = (n: number) => (BigInt(Math.round(n * 1e6)) * scale) / 1_000_000n;
  const buy = side === 'buy';
  if (!buy && (!onchainPx || onchainPx <= 0)) return { code: 'NO_PRICE' };
  const amount = buy ? toRaw(usd) : toRaw(usd / onchainPx!);

  try {
    const res = await deps.web3.get<QuoteItem[]>('/api/v1/dex/aggregator/quote', {
      binanceChainId: BSC,
      amount: amount.toString(),
      fromTokenAddress: buy ? USDT_BSC : venue.address,
      toTokenAddress: buy ? venue.address : USDT_BSC,
      userWalletAddress: deps.quoteWallet,
    });
    const q = res.data[0];
    if (!q) return { code: 'NO_QUOTE' };
    const from = Number(q.fromTokenAmount) / 10 ** Number(q.fromToken.decimal);
    const to = Number(q.toTokenAmount) / 10 ** Number(q.toToken.decimal);
    if (from <= 0 || to <= 0) return { code: 'NO_QUOTE' };
    return { pxPerToken: buy ? from / to : to / from, vendor: q.vendorName };
  } catch (error) {
    if (error instanceof Web3ApiError) return { code: error.code };
    throw error;
  }
}

async function buildVenue(deps: GatherDeps, req: GatherRequest, venue: Venue, onchain: Onchain): Promise<RouteVenueInput> {
  const key = venue.address.toLowerCase();
  const onchainPx = onchain.px.get(key) ?? null;
  const onchainAt = onchain.at.has(key) ? new Date(onchain.at.get(key)!) : null;

  // xStocks on BSC: 1 (confirmed against the 22 Sep bapi fixtures). Null means unknown: the venue is excluded
  // rather than ranked on a per-share price that could be off by the whole ratio.
  let shareRatio: number | null = venue.issuer === 'xstocks' ? 1 : null;
  let multiplierPending = false;
  let oraclePxAtToken: number | null = null;
  let oracleAt: Date | null = null;

  if (venue.issuer === 'bstocks') {
    try {
      const m = await readMultiplier(deps.chain, venue.address);
      shareRatio = m.multiplier;
      multiplierPending = m.pending !== null;
    } catch {
      // Chain RPC hiccup: ratio stays unknown.
    }
    const feed = APRO_FEEDS_BSC[venue.symbol];
    if (feed) {
      try {
        const o = await readAproFeed(deps.chain, feed);
        oraclePxAtToken = o.price;
        oracleAt = o.updatedAt;
      } catch {
        // No oracle reading this run; the gate treats a missing oracle as "not applicable", not a failure.
      }
    }
  } else if (venue.issuer === 'ondo') {
    const rp = onchain.refPx.get(key);
    if (onchainPx !== null && rp) shareRatio = onchainPx / rp; // SPEC 3.2: tokenPrice / referencePrice.
  }

  const base = {
    issuer: venue.issuer,
    symbol: venue.symbol,
    address: venue.address,
    onchainPx,
    onchainAt,
    oraclePxAtToken,
    oracleAt,
    multiplierPending,
    halted: false,
  };
  const atRequested = await fetchQuote(deps, venue, req.side, onchainPx ?? undefined, req.amountUsd);
  const at100 = req.amountUsd === 100 ? atRequested : await fetchQuote(deps, venue, req.side, onchainPx ?? undefined, 100);

  // A failed quote explains more (e.g. 40304) than the missing ratio, so only a successful quote is overridden.
  if (shareRatio === null && 'pxPerToken' in atRequested) {
    return { ...base, shareRatio: 1, execPxAtAmount: null, execPxAt100: null, quoteVendor: null, quoteError: 'NO_SHARE_RATIO' };
  }
  return {
    ...base,
    shareRatio: shareRatio ?? 1,
    execPxAtAmount: 'pxPerToken' in atRequested ? atRequested.pxPerToken : null,
    execPxAt100: 'pxPerToken' in at100 ? at100.pxPerToken : null,
    quoteVendor: 'vendor' in atRequested ? atRequested.vendor : null,
    quoteError: 'code' in atRequested ? atRequested.code : null,
  };
}

/** Everything quoteRoute needs for one instrument, fetched live. */
export async function gatherRouteInputs(deps: GatherDeps, req: GatherRequest): Promise<Gathered> {
  const onchain = await fetchOnchain(deps.web3, req.instrument);
  const venues = await Promise.all(req.instrument.venues.map((v) => buildVenue(deps, req, v, onchain)));
  return { venues, referenceSep: onchain.referenceSep, referenceSource: onchain.referenceSep === null ? null : 'binance-derived' };
}
