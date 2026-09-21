import type { Instrument } from '@oneticker/core';
import type { Collect } from './collect';
import type { TapeDb } from './db';

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
    const results = await collect(instruments);
    const state = marketState?.(started) ?? null;
    db.raw.transaction(() => {
      for (const { instrument, venue, raw } of results) {
        db.insertSnapshot(runId, {
          ts,
          instrument: instrument.id,
          venue: venue.issuer,
          marketState: state,
          referencePx: null,
          referenceTs: null,
          onchainPx: null,
          execPx100: null,
          execPx1k: null,
          execPx10k: null,
          oraclePx: null,
          oracleUpdatedAt: null,
          indexPx: null,
          indexFrozen: null,
          shareRatio: null,
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
