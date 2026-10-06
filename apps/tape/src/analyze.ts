// Tape analysis (T15).
//
//   pnpm --filter tape analyze [--db path] [--from ISO] [--to ISO] [--source "where the database came from"]
//
// Reads a Tape database (read-only) and writes docs/tape-findings.md plus the two JSON files the /tape page reads.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { instruments } from '@oneticker/core';
import { analyze, series, type Issuer, type Sample, type VenueSample } from './analysis';
import { renderReport } from './analysis-report';
import { loadConfig } from './config';

const REPO = resolve(import.meta.dirname, '../../..');
/** The web chart breaks a line across gaps over 15 minutes, so buckets stay under that. */
const BUCKET_MIN = 10;
/** Three decimals is plenty for prices and bps, and keeps the page's JSON small. */
const round = (_key: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Row {
  run_id: number;
  ts: string;
  instrument: string;
  venue: Issuer;
  share_ratio: number | null;
  exec_px_100: number | null;
  exec_px_1k: number | null;
  exec_px_10k: number | null;
  pool_px: number | null;
  onchain_px: number | null;
  oracle_px: number | null;
  oracle_updated_at: string | null;
  perp_mark_px: number | null;
}

const config = loadConfig();
const dbPath = arg('db') ? resolve(arg('db')!) : config.dbPath;
const db = new Database(dbPath, { readonly: true });

const first = db.prepare('SELECT MIN(ts) AS ts FROM snapshots WHERE exec_px_100 IS NOT NULL').get() as { ts: string | null };
const from = arg('from') ?? first.ts;
if (!from) throw new Error(`No Binance quotes in ${dbPath}; nothing to analyze`);
const to = arg('to') ?? '9999-12-31T00:00:00.000Z';

const rows = db
  .prepare(
    `SELECT s.run_id, s.ts, s.instrument, s.venue, s.share_ratio, s.exec_px_100, s.exec_px_1k, s.exec_px_10k, s.pool_px, s.onchain_px, s.oracle_px, s.oracle_updated_at, u.perp_mark_px
       FROM snapshots s LEFT JOIN underlying u ON u.run_id = s.run_id AND u.instrument = s.instrument
      WHERE s.ts >= ? AND s.ts <= ? ORDER BY s.ts`,
  )
  .all(from, to) as Row[];

const known = new Set(instruments.map((i) => i.id));
const byKey = new Map<string, Sample>();
for (const r of rows) {
  if (!known.has(r.instrument)) continue;
  const key = `${r.run_id}|${r.instrument}`;
  const sample = byKey.get(key) ?? byKey.set(key, { ts: r.ts, instrument: r.instrument, perp: r.perp_mark_px, venues: {} }).get(key)!;
  const venue: VenueSample = {
    ratio: r.share_ratio,
    exec: { '100': r.exec_px_100, '1k': r.exec_px_1k, '10k': r.exec_px_10k },
    pool: r.pool_px,
    onchainPx: r.onchain_px,
    oraclePx: r.oracle_px,
    oracleUpdatedAt: r.oracle_updated_at,
  };
  sample.venues[r.venue] = venue;
}
const samples = [...byKey.values()];

const runs = (db.prepare('SELECT COUNT(*) AS n FROM runs WHERE ok = 1 AND started_at >= ? AND started_at <= ?').get(from, to) as { n: number }).n;
const findings = analyze(samples, runs);

const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${path.replace(`${REPO}/`, '')}`);
};
write(resolve(REPO, 'docs/tape-findings.md'), renderReport(findings, { generatedAt: new Date().toISOString().slice(0, 16) + ' UTC', intervalSec: config.intervalSec, source: arg('source') ?? 'the Tape database' }));
write(resolve(REPO, 'apps/web/src/data/tape-findings.json'), JSON.stringify(findings, round));
write(
  resolve(REPO, 'apps/web/src/data/tape-series.json'),
  JSON.stringify({ bucketMin: BUCKET_MIN, from: findings.window.from, to: findings.window.to, instruments: Object.fromEntries(instruments.map((i) => [i.id, series(samples, i.id, BUCKET_MIN)])) }, round),
);
