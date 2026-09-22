// oneticker CLI (T5). Ranks every venue for one instrument by share-equivalent price, with a gate verdict
// per venue and a plain-English reason for any venue an API error ruled out (SPEC 3.6).
//
//   pnpm oneticker quote NVDA buy 500

import { APRO_FEEDS_BSC, createBscClient, createWeb3Client, readAproFeed, readMultiplier, Web3ApiError, type Web3Client } from '@oneticker/clients';
import { formatDuration, instruments, isRwaVenue, quoteRoute, type RouteVenueInput, type Venue } from '@oneticker/core';

const BSC = '56';
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD, 18 decimals

function usage(): never {
  console.error('Usage: pnpm oneticker quote <TICKER> <buy|sell> <amountUsd>');
  console.error(`Known tickers: ${instruments.map((i) => i.ticker).join(', ')}`);
  process.exit(1);
}

const [cmd, tickerArg, sideArg, amountArg] = process.argv.slice(2);
if (cmd !== 'quote' || !tickerArg || !sideArg || !amountArg) usage();
const sideRaw = sideArg.toLowerCase();
if (sideRaw !== 'buy' && sideRaw !== 'sell') usage();
// Explicit annotation: narrowing from the check above doesn't carry into the closures defined below.
const side: 'buy' | 'sell' = sideRaw;
const amountUsd = Number(amountArg);
if (!Number.isFinite(amountUsd) || amountUsd <= 0) usage();

const instrument = instruments.find((i) => i.ticker === tickerArg.toUpperCase());
if (!instrument) usage();

const apiKey = process.env.BINANCE_WEB3_API_KEY;
const apiSecret = process.env.BINANCE_WEB3_API_SECRET;
const web3: Web3Client | null =
  apiKey && apiSecret ? createWeb3Client({ apiKey, apiSecret, ...(process.env.BINANCE_WEB3_BASE_URL ? { baseUrl: process.env.BINANCE_WEB3_BASE_URL } : {}) }) : null;
const chain = createBscClient(process.env.BSC_RPC_URL);
const wallet = process.env.TAPE_QUOTE_WALLET;

if (!web3) console.error('note: BINANCE_WEB3_API_KEY / BINANCE_WEB3_API_SECRET not set — every venue will show excluded (NO_API_KEYS)\n');

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

/** rwa/price (RWA venues, has referencePrice too) plus market/price (all venues, the only source for xStocks). */
async function fetchOnchain(): Promise<{ px: Map<string, number>; refPx: Map<string, number>; at: Map<string, number>; referenceSep: number | null }> {
  const px = new Map<string, number>();
  const refPx = new Map<string, number>();
  const at = new Map<string, number>();
  let referenceSep: number | null = null;
  if (!web3) return { px, refPx, at, referenceSep };

  const rwaVenues = instrument!.venues.filter(isRwaVenue);
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
      // Left unset; the per-venue quote errors below already explain the outage.
    }
  }
  try {
    const res = await web3.post<MarketItem[]>('/api/v1/dex/market/price', instrument!.venues.map((v) => ({ binanceChainId: BSC, tokenContractAddress: v.address })));
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
async function fetchQuote(venue: Venue, onchainPx: number | undefined, usd: number): Promise<{ pxPerToken: number; vendor: string } | { code: string }> {
  if (!web3) return { code: 'NO_API_KEYS' };
  const scale = 10n ** BigInt(venue.decimals);
  const toRaw = (n: number) => (BigInt(Math.round(n * 1e6)) * scale) / 1_000_000n;
  const buy = side === 'buy';
  if (!buy && (!onchainPx || onchainPx <= 0)) return { code: 'NO_PRICE' };
  const amount = buy ? toRaw(usd) : toRaw(usd / onchainPx!);

  try {
    const res = await web3.get<QuoteItem[]>('/api/v1/dex/aggregator/quote', {
      binanceChainId: BSC,
      amount: amount.toString(),
      fromTokenAddress: buy ? USDT_BSC : venue.address,
      toTokenAddress: buy ? venue.address : USDT_BSC,
      userWalletAddress: wallet,
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

async function buildVenue(venue: Venue, px: Map<string, number>, refPx: Map<string, number>, at: Map<string, number>): Promise<RouteVenueInput> {
  const key = venue.address.toLowerCase();
  const onchainPx = px.get(key) ?? null;
  const onchainAt = at.has(key) ? new Date(at.get(key)!) : null;

  let shareRatio = 1;
  let multiplierPending = false;
  let oraclePxAtToken: number | null = null;
  let oracleAt: Date | null = null;

  if (venue.issuer === 'bstocks') {
    try {
      const m = await readMultiplier(chain, venue.address);
      shareRatio = m.multiplier;
      multiplierPending = m.pending !== null;
    } catch {
      // Chain RPC hiccup: fall back to 1 rather than fail the whole quote.
    }
    const feed = APRO_FEEDS_BSC[venue.symbol];
    if (feed) {
      try {
        const o = await readAproFeed(chain, feed);
        oraclePxAtToken = o.price;
        oracleAt = o.updatedAt;
      } catch {
        // No oracle reading this run; the gate treats a missing oracle as "not applicable", not a failure.
      }
    }
  } else if (venue.issuer === 'ondo') {
    const rp = refPx.get(key);
    if (onchainPx !== null && rp) shareRatio = onchainPx / rp; // SPEC 3.2: tokenPrice / referencePrice.
  } // xStocks: shareRatio stays 1 (confirmed against the 22 Sep bapi fixtures).

  const atRequested = await fetchQuote(venue, onchainPx ?? undefined, amountUsd);
  const at100 = amountUsd === 100 ? atRequested : await fetchQuote(venue, onchainPx ?? undefined, 100);

  return {
    issuer: venue.issuer,
    symbol: venue.symbol,
    address: venue.address,
    shareRatio,
    onchainPx,
    onchainAt,
    execPxAtAmount: 'pxPerToken' in atRequested ? atRequested.pxPerToken : null,
    execPxAt100: 'pxPerToken' in at100 ? at100.pxPerToken : null,
    quoteVendor: 'vendor' in atRequested ? atRequested.vendor : null,
    quoteError: 'code' in atRequested ? atRequested.code : null,
    oraclePxAtToken,
    oracleAt,
    multiplierPending,
    halted: false,
  };
}

async function main(): Promise<void> {
  const { px, refPx, at, referenceSep } = await fetchOnchain();
  const venues = await Promise.all(instrument!.venues.map((v) => buildVenue(v, px, refPx, at)));
  const result = quoteRoute({ ticker: instrument!.ticker, side, amountUsd, referenceSep, venues, now: new Date() });

  console.log(`${result.ticker}  ${result.side} $${result.amountUsd}`);
  console.log(`market: ${result.clock.state}${result.clock.state !== 'REGULAR' ? ` (reference ${formatDuration(result.clock.referenceAgeSec)} old)` : ''}`);
  console.log(`reference: ${result.referenceSep !== null ? `$${result.referenceSep.toFixed(4)} per share (Binance's derived price — not an independent quote)` : 'none available'}`);
  console.log('');

  if (result.routes.length === 0) console.log('No venue can quote right now.');
  result.routes.forEach((route, i) => {
    const premium = route.premiumBps !== null ? `${route.premiumBps >= 0 ? '+' : ''}${Math.round(route.premiumBps)} bps` : '—';
    console.log(`${i + 1}. ${route.symbol.padEnd(8)} ${route.issuer.padEnd(8)} $${route.sep.toFixed(4)}/share  ${premium.padStart(9)}  ${route.gate.verdict}${route.vendor ? `  via ${route.vendor}` : ''}`);
    for (const reason of route.gate.reasons) console.log(`     ${reason.detail}`);
  });

  if (result.excluded.length > 0) {
    console.log('\nExcluded:');
    for (const e of result.excluded) console.log(`  ${e.symbol.padEnd(8)} ${e.issuer.padEnd(8)} ${e.reason} (${e.code})`);
  }
}

await main();
