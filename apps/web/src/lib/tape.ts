// The /tape page's data: the Tape's analysis (pnpm --filter tape analyze), committed as JSON so the page works with no live Tape.
import findings from '@/data/tape-findings.json';
import series from '@/data/tape-series.json';
import { closedStretches, type History, type HistoryPoint } from './history';

type Group = 'open' | 'weeknight' | 'weekend';

/** The fields of the analysis this page reads. The full shape lives in apps/tape/src/analysis.ts. */
export interface TapeFindings {
  window: { from: string; to: string; samples: number; runs: number; instruments: number };
  coverage: Record<Group, { samples: number; xstocksQuote100: number }>;
  issuerSpread: Record<'100' | '1k' | '10k', Record<Group, { n: number; bstocksCheapest: number; ondoOver10pct: number }>>;
  poolVsPerp: Record<Group, { n: number; p50: number | null; maxAbs: number | null }>;
  refStaleShareClosed: number;
}

export const tape = findings as unknown as TapeFindings;

/** Tape runs the window could hold at the Tape's 5-minute spacing. */
export function possibleRuns(): number {
  return Math.floor((Date.parse(tape.window.to) - Date.parse(tape.window.from)) / 300_000) + 1;
}

/** The recorded window for one instrument as the chart's History, or null when there is nothing to draw. */
export function recordedHistory(instrumentId: string): History | null {
  const points = (series.instruments as unknown as Record<string, HistoryPoint[]>)[instrumentId];
  if (!points || points.length < 2) return null;
  const from = Date.parse(series.from);
  const to = Date.parse(series.to);
  return { from, to, points, closed: closedStretches(from, to) };
}
