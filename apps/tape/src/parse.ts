import type { Venue } from '@oneticker/core';
import type { Captured } from './collect';

/** Field shapes confirmed by fixtures/web3/*-20260922T11*.json. */
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
  fromTokenAmount: string;
  toTokenAmount: string;
  fromToken: { decimal: string };
  toToken: { decimal: string };
  vendorName: string;
  priceImpactPercent: string;
}

export interface ParsedVenue {
  /** USD per raw token from /rwa/price (bStocks, Ondo) or /market/price (xStocks). */
  onchainPx: number | null;
  onchainTs: string | null;
  /** USD per raw token actually payable at each notional; null when the quote failed. */
  execPx: Record<'100' | '1000' | '10000', number | null>;
  /** Shares per raw token for Ondo, derived as tokenPrice / referencePrice. Null elsewhere (bStocks: on-chain; xStocks: 1). */
  shareRatio: number | null;
  /** API error code per notional when a quote was refused (e.g. 40374, 40369, NO_API_KEYS). */
  quoteErrors: Record<string, string>;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const num = (s: string | undefined | null): number | null => (s === undefined || s === null || s === '' || !Number.isFinite(Number(s)) ? null : Number(s));

function items<T>(captured: Captured | null): T[] {
  if (!captured || !captured.ok) return [];
  const data = (captured.envelope as { data?: unknown }).data;
  return Array.isArray(data) ? (data as T[]) : [];
}

/** USD per token paid: (USDT in / 10^18) / (tokens out / 10^decimals). USDT is treated as $1. */
export function quotePrice(quote: QuoteItem): number | null {
  const from = Number(quote.fromTokenAmount) / 10 ** Number(quote.fromToken.decimal);
  const to = Number(quote.toTokenAmount) / 10 ** Number(quote.toToken.decimal);
  return from > 0 && to > 0 ? from / to : null;
}

export function parseVenue(venue: Venue, raw: { rwaPrice: Captured | null; marketPrice: Captured | null; quotes: Record<string, Captured> }): ParsedVenue {
  const rwa = items<RwaPriceItem>(raw.rwaPrice).find((i) => same(i.tokenContractAddress, venue.address));
  const market = items<MarketPriceItem>(raw.marketPrice).find((i) => same(i.tokenContractAddress, venue.address));

  let onchainPx: number | null = null;
  let onchainTs: string | null = null;
  if (rwa) {
    onchainPx = num(rwa.tokenPrice);
    onchainTs = new Date(rwa.tokenPriceUpdatedAt).toISOString();
  } else if (market) {
    onchainPx = num(market.price);
    onchainTs = new Date(market.time).toISOString();
  }

  const shareRatio = venue.issuer === 'ondo' && rwa && num(rwa.tokenPrice) && num(rwa.referencePrice) ? Number(rwa.tokenPrice) / Number(rwa.referencePrice) : null;

  const execPx: ParsedVenue['execPx'] = { '100': null, '1000': null, '10000': null };
  const quoteErrors: Record<string, string> = {};
  for (const usd of ['100', '1000', '10000'] as const) {
    const captured = raw.quotes[usd];
    if (!captured) continue;
    if (!captured.ok) {
      quoteErrors[usd] = captured.code;
      continue;
    }
    const best = items<QuoteItem>(captured)[0];
    execPx[usd] = best ? quotePrice(best) : null;
  }

  return { onchainPx, onchainTs, execPx, shareRatio, quoteErrors };
}
