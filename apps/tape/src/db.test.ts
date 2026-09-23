import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openTape } from './db';

describe('openTape migration', () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('adds the new snapshot columns to a database created before them, keeping its rows', () => {
    dir = mkdtempSync(join(tmpdir(), 'tape-'));
    const path = join(dir, 'tape.sqlite');
    // The schema as first deployed on 21 Sep 2026.
    const old = new Database(path);
    old.exec(`
      CREATE TABLE runs (id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, ok INTEGER, snapshots INTEGER NOT NULL DEFAULT 0, error TEXT);
      CREATE TABLE snapshots (id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL REFERENCES runs(id), ts TEXT NOT NULL, instrument TEXT NOT NULL,
        venue TEXT NOT NULL, market_state TEXT, reference_px REAL, reference_ts TEXT, onchain_px REAL, exec_px_100 REAL, exec_px_1k REAL,
        exec_px_10k REAL, oracle_px REAL, oracle_updated_at TEXT, index_px REAL, index_frozen INTEGER, share_ratio REAL, raw_json TEXT NOT NULL);
      INSERT INTO runs (id, started_at) VALUES (1, '2026-09-22T12:00:00.000Z');
      INSERT INTO snapshots (run_id, ts, instrument, venue, oracle_px, raw_json) VALUES (1, '2026-09-22T12:00:00.000Z', 'US:NVDA', 'bstocks', 226.9, '{}');`);
    old.close();

    const db = openTape(path);
    const columns = (db.raw.prepare('PRAGMA table_info(snapshots)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['pool_px', 'pool_depth_usd', 'index_ts', 'cex_px']));
    expect(db.latestSnapshots()).toMatchObject([{ oracle_px: 226.9, pool_px: null }]);
    db.close();

    // Opening again is a no-op, not a duplicate-column error.
    openTape(path).close();
  });
});
