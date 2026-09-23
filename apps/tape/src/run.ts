import type { Instrument } from '@oneticker/core';
import type { Collect } from './collect';
import type { TapeDb } from './db';
import { parseVenue } from './parse';

export interface RunDeps {
  db: TapeDb;
  instruments: readonly Instrument[];
  collect: Collect;
  marketState?: (at: Date) => string;
  now?: () => Date;
  log?: (line: string) => void;
}

export interface RunSummary {
  runId: number;
  startedAt: string;
  ok: boolean;
  snapshots: number;
  ms: number;
  error: string | null;
}

/** One Tape run. Never throws: a failure is recorded in `runs` and logged as a RUN_FAILED line. */
export async function runOnce({ db, instruments, collect, marketState, now = () => new Date(), log = console.log }: RunDeps): Promise<RunSummary> {
  const started = now();
  const ts = started.toISOString();
  const runId = db.startRun(ts);
  let snapshots = 0;
  let error: string | null = null;

  try {
    if (instruments.length === 0) throw new Error('registry is empty: fill packages/core/src/registry/instruments.json (T1)');
    const { venues: results, underlyings } = await collect(instruments);
    const state = marketState?.(started) ?? null;
    db.raw.transaction(() => {
      for (const { instrument, venue, oracle, multiplier, pool, index, spotPx, raw } of results) {
        const parsed = parseVenue(venue, raw);
        db.insertSnapshot(runId, {
          ts,
          instrument: instrument.id,
          venue: venue.issuer,
          marketState: state,
          referencePx: null,
          referenceTs: null,
          onchainPx: parsed.onchainPx,
          execPx100: parsed.execPx['100'],
          execPx1k: parsed.execPx['1000'],
          execPx10k: parsed.execPx['10000'],
          oraclePx: oracle?.price ?? null,
          oracleUpdatedAt: oracle?.updatedAt.toISOString() ?? null,
          indexPx: index?.price ?? null,
          indexFrozen: null,
          shareRatio: multiplier?.multiplier ?? parsed.shareRatio ?? (venue.issuer === 'xstocks' ? 1 : null),
          poolPx: pool?.pxPerToken ?? null,
          poolDepthUsd: pool?.depthUsd ?? null,
          indexTs: index?.at.toISOString() ?? null,
          cexPx: spotPx,
          raw,
        });
        for (const [usd, code] of Object.entries(parsed.quoteErrors)) {
          db.insertEvent({ ts, instrument: instrument.id, venue: venue.issuer, kind: 'QUOTE_EXCLUDED', detail: `${code} at $${usd}` });
        }
      }
      for (const { instrument, perp, raw } of underlyings) {
        db.insertUnderlying(runId, {
          ts,
          instrument: instrument.id,
          perpMarkPx: perp?.markPrice ?? null,
          perpIndexPx: perp?.indexPrice ?? null,
          perpFundingRate: perp?.lastFundingRate ?? null,
          perpTs: perp?.at.toISOString() ?? null,
          raw,
        });
      }
    })();
    snapshots = results.length;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const finished = now();
  db.finishRun(runId, { finishedAt: finished.toISOString(), ok: error === null, snapshots, error });
  const summary: RunSummary = { runId, startedAt: ts, ok: error === null, snapshots, ms: finished.getTime() - started.getTime(), error };
  log(`${summary.ok ? 'RUN' : 'RUN_FAILED'} ${JSON.stringify(summary)}`);
  return summary;
}
