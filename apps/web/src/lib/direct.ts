// Live quotes read straight from Binance's Web3 API on the server, for a deployment with no Tape behind it.
// It is the same read path the CLI and MCP server use (gatherRouteInputs), so the numbers match theirs. Cached for a
// minute per server instance so a burst of visitors costs one round of calls, and any failure returns null so the
// pages fall back to saved fixtures.
import { createBscClient, createWeb3Client, gatherRouteInputs, readPerpMark, type Gathered } from '@oneticker/clients';
import { instruments, type Instrument } from '@oneticker/core';
import { buildView, type InstrumentView, type VenueInput } from './view';

const TTL_MS = 60_000;
const BUDGET_MS = 25_000;

/** Keys must be set, and the production build (run elsewhere, outside an allowed country) must not try to read them. */
export function directEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BINANCE_WEB3_API_KEY && env.BINANCE_WEB3_API_SECRET) && env.NEXT_PHASE !== 'phase-production-build';
}

/** Pure: one instrument's gathered surfaces as the view layer's input. Prices stay per raw token, as the view expects. */
export function toViewInput(instrument: Instrument, gathered: Gathered, asOf: Date, now: Date) {
  return {
    ticker: instrument.ticker,
    name: instrument.name,
    source: 'live' as const,
    asOf,
    now,
    referenceSep: gathered.referenceSep,
    referenceNote: gathered.referenceSep === null ? 'no reference price available' : "Binance's underlying-market reference (derived from the token price; an independent quote replaces it)",
    perpSep: gathered.perpSep,
    venues: gathered.venues.map(
      (v): VenueInput => ({
        issuer: v.issuer,
        symbol: v.symbol,
        address: v.address,
        shareRatio: v.shareRatio,
        onchainPx: v.onchainPx,
        onchainAt: v.onchainAt?.getTime() ?? null,
        execPxToken: v.execPxAtAmount,
        quoteVendor: v.quoteVendor,
        quoteError: v.quoteError,
        oraclePxToken: v.oraclePxAtToken,
        oracleAt: v.oracleAt?.getTime() ?? null,
        multiplierPending: v.multiplierPending,
      }),
    ),
  };
}

let cached: { at: number; views: Promise<InstrumentView[] | null> } | null = null;

async function read(now: Date): Promise<InstrumentView[] | null> {
  const env = process.env;
  const web3 = createWeb3Client({ apiKey: env.BINANCE_WEB3_API_KEY!, apiSecret: env.BINANCE_WEB3_API_SECRET!, ...(env.BINANCE_WEB3_BASE_URL ? { baseUrl: env.BINANCE_WEB3_BASE_URL } : {}) });
  const deps = { web3, chain: createBscClient(env.BSC_RPC_URL), quoteWallet: env.TAPE_QUOTE_WALLET, perp: (ticker: string) => readPerpMark(ticker) };
  const gathered = await Promise.race([
    Promise.all(instruments.map((i) => gatherRouteInputs(deps, { instrument: i, side: 'buy', amountUsd: 100 }))),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), BUDGET_MS)),
  ]);
  if (!gathered) return null;
  const asOf = new Date();
  return instruments.map((i, n) => buildView(toViewInput(i, gathered[n]!, asOf, now)));
}

/** Live views for every instrument, or null when keys are missing, the read fails or times out. */
export function directViews(now: Date): Promise<InstrumentView[] | null> {
  if (!directEnabled()) return Promise.resolve(null);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.views;
  const views = read(now).catch(() => null);
  cached = { at: Date.now(), views };
  // A failed read is not worth a minute of waiting: let the next request try again.
  void views.then((v) => {
    if (v === null && cached?.views === views) cached = null;
  });
  return views;
}
