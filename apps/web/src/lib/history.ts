// The last 72 hours for one instrument, from the Tape's /api/history, as per-share series for the chart (T13).
import { marketClock } from '@oneticker/core';
import { TAPE_API_URL } from './live';

interface HistoryRow {
  ts: string;
  venue: string;
  exec_px_100: number | null;
  share_ratio: number | null;
  pool_px: number | null;
}
interface UnderlyingRow {
  ts: string;
  perp_mark_px: number | null;
}

/** One Tape run. Every price is USD per underlying share; null where that surface had no reading. */
export interface HistoryPoint {
  t: number;
  /** Binance TradFi perpetual on the stock: trades 24/7, so it is the reference when Wall Street is closed. */
  perp: number | null;
  /** PancakeSwap v3 pool mid price for the bStocks token, read from BSC. */
  pool: number | null;
  /** The cheapest $100 quote across the three issuers. */
  quote: number | null;
}

export interface History {
  from: number;
  to: number;
  points: HistoryPoint[];
  /** [start, end] ms of every stretch in the window when the US regular session was closed. */
  closed: [number, number][];
}

export const HISTORY_HOURS = 72;
const STEP_MS = 5 * 60_000;

/** Closed stretches from the market clock, sampled every 5 minutes (the Tape's own cadence). */
export function closedStretches(from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let t = from; t <= to; t += STEP_MS) {
    const closed = marketClock(new Date(t)).state !== 'REGULAR';
    if (closed && start === null) start = t;
    if (!closed && start !== null) {
      out.push([start, t]);
      start = null;
    }
  }
  if (start !== null) out.push([start, to]);
  return out;
}

/** Pure: Tape rows to one point per run. Exported for tests. */
export function toPoints(rows: HistoryRow[], underlying: UnderlyingRow[]): HistoryPoint[] {
  const byTs = new Map<string, HistoryPoint>();
  const point = (ts: string) => {
    let p = byTs.get(ts);
    if (!p) byTs.set(ts, (p = { t: Date.parse(ts), perp: null, pool: null, quote: null }));
    return p;
  };
  for (const r of rows) {
    const p = point(r.ts);
    const ratio = r.share_ratio && r.share_ratio > 0 ? r.share_ratio : null;
    if (ratio === null) continue; // Without shares per token, a token price is not a share price.
    if (r.venue === 'bstocks' && r.pool_px !== null) p.pool = r.pool_px / ratio;
    if (r.exec_px_100 !== null) {
      const sep = r.exec_px_100 / ratio;
      p.quote = p.quote === null ? sep : Math.min(p.quote, sep);
    }
  }
  for (const u of underlying) if (u.perp_mark_px !== null) point(u.ts).perp = u.perp_mark_px;
  return [...byTs.values()].filter((p) => p.perp !== null || p.pool !== null || p.quote !== null).sort((a, b) => a.t - b.t);
}

export async function getHistory(instrumentId: string, now = new Date()): Promise<History | null> {
  if (!TAPE_API_URL) return null;
  try {
    const res = await fetch(`${TAPE_API_URL}/api/history?instrument=${encodeURIComponent(instrumentId)}&hours=${HISTORY_HOURS}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { rows: HistoryRow[]; underlying?: UnderlyingRow[] };
    const to = now.getTime();
    const from = to - HISTORY_HOURS * 3_600_000;
    return { from, to, points: toPoints(body.rows, body.underlying ?? []), closed: closedStretches(from, to) };
  } catch {
    return null;
  }
}
