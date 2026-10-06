// pnpm --filter tape metrics --db <path> --title "..." --note "..." [--db <path> --title "..." --note "..."]
// Each --db starts a section; the --title and --note after it belong to it. Writes dx/metrics.md.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { renderMetrics, summarize, type CallRow, type Section } from './metrics';

const REPO = resolve(import.meta.dirname, '../../..');
const sections: (Partial<Section> & { db?: string })[] = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];
  if (value === undefined) throw new Error(`${flag} needs a value`);
  if (flag === '--db') sections.push({ db: resolve(value) });
  else if (sections.length === 0) throw new Error(`${flag} must come after a --db`);
  else if (flag === '--title') sections[sections.length - 1]!.title = value;
  else if (flag === '--note') sections[sections.length - 1]!.note = value;
  else throw new Error(`unknown flag ${flag}`);
}
if (sections.length === 0) throw new Error('give at least one --db');

const done: Section[] = sections.map((s) => {
  const db = new Database(s.db!, { readonly: true });
  const rows = db.prepare('SELECT ts, endpoint, http_status, latency_ms, error_code FROM api_calls').all() as (CallRow & { ts: string })[];
  return { title: s.title ?? s.db!, note: s.note ?? '', metrics: summarize(rows) };
});

const path = resolve(REPO, 'dx/metrics.md');
writeFileSync(path, renderMetrics(done, new Date().toISOString().slice(0, 16) + ' UTC'));
console.log(`wrote dx/metrics.md (${done.map((d) => d.metrics.calls).join(' + ')} calls)`);
