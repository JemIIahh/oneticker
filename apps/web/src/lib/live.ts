// Live data: the Tape's read-only API on Railway (apps/tape/src/api.ts). Refreshed every minute.
import type { Issuer } from '@oneticker/core';
import { buildView, type InstrumentView, type VenueInput } from './view';

interface Snapshot {
  ts: string;
  onchain_px: number | null;
  exec_px_100: number | null;
  oracle_px: number | null;
  oracle_updated_at: string | null;
  share_ratio: number | null;
}
interface LatestPayload {
  asOf: string | null;
  instruments: { id: string; ticker: string; name: string; venues: { issuer: Issuer; symbol: string; address: string; snapshot: Snapshot | null; exclusions: string[] }[] }[];
}

export const TAPE_API_URL = process.env.TAPE_API_URL?.replace(/\/$/, '');

export async function fetchLatest(): Promise<LatestPayload | null> {
  if (!TAPE_API_URL) return null;
  try {
    const res = await fetch(`${TAPE_API_URL}/api/latest`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const payload = (await res.json()) as LatestPayload;
    return payload.asOf ? payload : null;
  } catch {
    return null;
  }
}

/** The "40374 at $100" event detail, reduced to its code. */
const codeOf = (exclusions: string[]) => exclusions.find((e) => e.endsWith('at $100'))?.split(' ')[0] ?? exclusions[0]?.split(' ')[0] ?? null;

export function liveViews(payload: LatestPayload, now: Date): InstrumentView[] {
  return payload.instruments.map((i) =>
    buildView({
      ticker: i.ticker,
      name: i.name,
      source: 'live',
      asOf: new Date(payload.asOf!),
      now,
      // No independent equity feed yet (needs a Finnhub key); Binance's own reference is derived, so it does not count.
      referenceSep: null,
      referenceNote: 'no independent equity quote yet; add a Finnhub key to enable it',
      venues: i.venues.map(
        (v): VenueInput => ({
          issuer: v.issuer,
          symbol: v.symbol,
          address: v.address,
          shareRatio: v.snapshot?.share_ratio ?? null,
          onchainPx: v.snapshot?.onchain_px ?? null,
          onchainAt: v.snapshot ? Date.parse(v.snapshot.ts) : null,
          execPxToken: v.snapshot?.exec_px_100 ?? null,
          quoteVendor: null,
          quoteError: codeOf(v.exclusions),
          oraclePxToken: v.snapshot?.oracle_px ?? null,
          oracleAt: v.snapshot?.oracle_updated_at ? Date.parse(v.snapshot.oracle_updated_at) : null,
          multiplierPending: false,
        }),
      ),
    }),
  );
}
