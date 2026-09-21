import { afterEach, describe, expect, it } from 'vitest';
import { checkDay } from './check';
import { openTape, type TapeDb } from './db';

const DAY = '2026-09-26';
const START = Date.parse(`${DAY}T00:00:00.000Z`);
const INTERVAL = 300;

function seedRuns(db: TapeDb, skip: (i: number) => boolean = () => false, ok: (i: number) => boolean = () => true): void {
  for (let i = 0; i < 288; i++) {
    if (skip(i)) continue;
    const ts = new Date(START + i * INTERVAL * 1000).toISOString();
    const id = db.startRun(ts);
    db.insertSnapshot(id, {
      ts, instrument: 'US:NVDA', venue: 'bstocks', marketState: null, referencePx: null, referenceTs: null, onchainPx: null,
      execPx100: null, execPx1k: null, execPx10k: null, oraclePx: null, oracleUpdatedAt: null, indexPx: null, indexFrozen: null, shareRatio: null, raw: {},
    });
    db.finishRun(id, { finishedAt: ts, ok: ok(i), snapshots: 1 });
  }
}

describe('checkDay', () => {
  let db: TapeDb;
  afterEach(() => db.close());

  it('passes a complete day', () => {
    db = openTape(':memory:');
    seedRuns(db);
    expect(checkDay(db, DAY, INTERVAL)).toMatchObject({ runs: 288, okRuns: 288, expectedRuns: 288, snapshots: 288, gaps: [], flags: [] });
  });

  it('flags a 1-hour outage as a gap even though the count is within 95%', () => {
    db = openTape(':memory:');
    seedRuns(db, (i) => i >= 36 && i < 48); // 03:00 to 04:00 missing
    const result = checkDay(db, DAY, INTERVAL);
    expect(result.okRuns).toBe(276);
    expect(result.gaps).toEqual([['2026-09-26T02:55:00.000Z', '2026-09-26T04:00:00.000Z']]);
    expect(result.flags).toEqual(['1 gaps longer than 10 min']);
  });

  it('flags failed runs even when the schedule held', () => {
    db = openTape(':memory:');
    seedRuns(db, undefined, (i) => i % 2 === 0);
    expect(checkDay(db, DAY, INTERVAL).flags).toEqual(['144/288 successful runs', '144 failed or unfinished runs']);
  });

  it('flags an empty day', () => {
    db = openTape(':memory:');
    expect(checkDay(db, DAY, INTERVAL).flags).toEqual(['0/288 successful runs', '1 gaps longer than 10 min', 'no snapshots']);
  });
});
