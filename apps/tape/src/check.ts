import type { TapeDb } from './db';

export interface DayCheck {
  day: string;
  runs: number;
  okRuns: number;
  expectedRuns: number;
  snapshots: number;
  /** Stretches longer than two intervals with no run started, as [from, to]. */
  gaps: [string, string][];
  flags: string[];
}

const DAY_MS = 86_400_000;

/** Row-count check for one UTC day (YYYY-MM-DD). Any flag means the Tape has a hole that day. */
export function checkDay(db: TapeDb, day: string, intervalSec: number): DayCheck {
  const fromMs = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(fromMs)) throw new Error(`bad day: ${day}`);
  const from = new Date(fromMs).toISOString();
  const to = new Date(fromMs + DAY_MS).toISOString();

  const runs = db.runsBetween(from, to);
  const okRuns = runs.filter((r) => r.ok === 1).length;
  const expectedRuns = Math.floor(86_400 / intervalSec);
  const snapshots = db.snapshotCountBetween(from, to);

  const gaps: [string, string][] = [];
  const times = [fromMs, ...runs.map((r) => Date.parse(r.started_at)), fromMs + DAY_MS];
  for (let i = 1; i < times.length; i++) {
    if (times[i]! - times[i - 1]! > 2 * intervalSec * 1000) {
      gaps.push([new Date(times[i - 1]!).toISOString(), new Date(times[i]!).toISOString()]);
    }
  }

  const flags: string[] = [];
  if (okRuns < Math.floor(expectedRuns * 0.95)) flags.push(`${okRuns}/${expectedRuns} successful runs`);
  if (runs.length > okRuns) flags.push(`${runs.length - okRuns} failed or unfinished runs`);
  if (gaps.length > 0) flags.push(`${gaps.length} gaps longer than ${(2 * intervalSec) / 60} min`);
  if (snapshots === 0) flags.push('no snapshots');

  return { day, runs: runs.length, okRuns, expectedRuns, snapshots, gaps, flags };
}
