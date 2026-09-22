import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { ApiCall } from '@oneticker/clients';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER,
  snapshots INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS runs_started_at ON runs(started_at);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id),
  ts TEXT NOT NULL,
  instrument TEXT NOT NULL,
  venue TEXT NOT NULL,
  market_state TEXT,
  reference_px REAL,
  reference_ts TEXT,
  onchain_px REAL,
  exec_px_100 REAL,
  exec_px_1k REAL,
  exec_px_10k REAL,
  oracle_px REAL,
  oracle_updated_at TEXT,
  index_px REAL,
  index_frozen INTEGER,
  share_ratio REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_instrument_ts ON snapshots(instrument, ts);

CREATE TABLE IF NOT EXISTS api_calls (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  error_code TEXT,
  bytes INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS api_calls_ts ON api_calls(ts);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  instrument TEXT,
  venue TEXT,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
`;

/** One venue at one moment. Parsed columns stay null until fixtures confirm the response fields. */
export interface SnapshotRow {
  ts: string;
  instrument: string;
  venue: string;
  marketState: string | null;
  referencePx: number | null;
  referenceTs: string | null;
  onchainPx: number | null;
  execPx100: number | null;
  execPx1k: number | null;
  execPx10k: number | null;
  oraclePx: number | null;
  oracleUpdatedAt: string | null;
  indexPx: number | null;
  indexFrozen: boolean | null;
  shareRatio: number | null;
  raw: unknown;
}

export interface EventRow {
  ts: string;
  instrument?: string | null;
  venue?: string | null;
  kind: string;
  detail: string;
}

/** A snapshots row as stored, without raw_json. */
export interface StoredSnapshot {
  id: number;
  run_id: number;
  ts: string;
  instrument: string;
  venue: string;
  market_state: string | null;
  reference_px: number | null;
  reference_ts: string | null;
  onchain_px: number | null;
  exec_px_100: number | null;
  exec_px_1k: number | null;
  exec_px_10k: number | null;
  oracle_px: number | null;
  oracle_updated_at: string | null;
  index_px: number | null;
  index_frozen: number | null;
  share_ratio: number | null;
}

export type HistoryRow = Pick<StoredSnapshot, 'ts' | 'venue' | 'market_state' | 'onchain_px' | 'exec_px_100' | 'exec_px_1k' | 'exec_px_10k' | 'oracle_px' | 'oracle_updated_at' | 'share_ratio'>;

export interface RunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  ok: number | null;
  snapshots: number;
  error: string | null;
}

export type TapeDb = ReturnType<typeof openTape>;

/** Opens (and creates if needed) the Tape database. Pass ':memory:' in tests. */
export function openTape(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const insertRun = db.prepare('INSERT INTO runs (started_at) VALUES (?)');
  const updateRun = db.prepare('UPDATE runs SET finished_at = ?, ok = ?, snapshots = ?, error = ? WHERE id = ?');
  const insertSnapshot = db.prepare(`
    INSERT INTO snapshots (run_id, ts, instrument, venue, market_state, reference_px, reference_ts, onchain_px,
      exec_px_100, exec_px_1k, exec_px_10k, oracle_px, oracle_updated_at, index_px, index_frozen, share_ratio, raw_json)
    VALUES (@runId, @ts, @instrument, @venue, @marketState, @referencePx, @referenceTs, @onchainPx,
      @execPx100, @execPx1k, @execPx10k, @oraclePx, @oracleUpdatedAt, @indexPx, @indexFrozen, @shareRatio, @rawJson)`);
  const insertApiCall = db.prepare(`
    INSERT INTO api_calls (ts, method, endpoint, http_status, latency_ms, error_code, bytes)
    VALUES (@ts, @method, @endpoint, @httpStatus, @latencyMs, @errorCode, @bytes)`);
  const insertEvent = db.prepare('INSERT INTO events (ts, instrument, venue, kind, detail) VALUES (?, ?, ?, ?, ?)');
  const runsBetween = db.prepare('SELECT * FROM runs WHERE started_at >= ? AND started_at < ? ORDER BY started_at');
  const snapshotCountBetween = db.prepare('SELECT COUNT(*) AS n FROM snapshots WHERE ts >= ? AND ts < ?');
  const latestSnapshots = db.prepare(`
    SELECT s.* FROM snapshots s
    WHERE s.run_id = (SELECT MAX(run_id) FROM snapshots)
    ORDER BY s.instrument, s.venue`);
  const historySince = db.prepare(`
    SELECT ts, venue, market_state, onchain_px, exec_px_100, exec_px_1k, exec_px_10k, oracle_px, oracle_updated_at, share_ratio
    FROM snapshots WHERE instrument = ? AND ts >= ? ORDER BY ts`);
  const latestEvents = db.prepare(`SELECT instrument, venue, kind, detail FROM events WHERE ts = (SELECT MAX(ts) FROM snapshots)`);

  return {
    raw: db,
    close: () => db.close(),

    startRun(startedAt: string): number {
      return Number(insertRun.run(startedAt).lastInsertRowid);
    },

    finishRun(id: number, result: { finishedAt: string; ok: boolean; snapshots: number; error?: string | null }): void {
      updateRun.run(result.finishedAt, result.ok ? 1 : 0, result.snapshots, result.error ?? null, id);
    },

    insertSnapshot(runId: number, row: SnapshotRow): void {
      const { raw, indexFrozen, ...rest } = row;
      insertSnapshot.run({
        ...rest,
        runId,
        indexFrozen: indexFrozen === null ? null : indexFrozen ? 1 : 0,
        rawJson: JSON.stringify(raw),
      });
    },

    insertApiCall(call: ApiCall): void {
      insertApiCall.run(call);
    },

    insertEvent(event: EventRow): void {
      insertEvent.run(event.ts, event.instrument ?? null, event.venue ?? null, event.kind, event.detail);
    },

    runsBetween(from: string, to: string): RunRow[] {
      return runsBetween.all(from, to) as RunRow[];
    },

    snapshotCountBetween(from: string, to: string): number {
      return (snapshotCountBetween.get(from, to) as { n: number }).n;
    },

    /** Every venue's row from the newest run, without raw_json. */
    latestSnapshots(): StoredSnapshot[] {
      return (latestSnapshots.all() as (StoredSnapshot & { raw_json: string })[]).map(({ raw_json: _raw, ...row }) => row);
    },

    historySince(instrument: string, fromTs: string): HistoryRow[] {
      return historySince.all(instrument, fromTs) as HistoryRow[];
    },

    latestEvents(): EventRow[] {
      return latestEvents.all() as EventRow[];
    },
  };
}
