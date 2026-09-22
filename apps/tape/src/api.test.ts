import { afterEach, describe, expect, it } from 'vitest';
import { instruments } from '@oneticker/core';
import { latestPayload } from './api';
import { openTape, type TapeDb } from './db';

describe('latestPayload', () => {
  let db: TapeDb;
  afterEach(() => db.close());

  it('returns every registry venue with its newest row and exclusions', () => {
    db = openTape(':memory:');
    const nvda = instruments.find((i) => i.ticker === 'NVDA')!;
    const blank = { marketState: null, referencePx: null, referenceTs: null, execPx1k: null, execPx10k: null, oraclePx: null, oracleUpdatedAt: null, indexPx: null, indexFrozen: null, raw: {} };
    // An older run, then the newest one; only the newest should be served.
    const old = db.startRun('2026-09-26T09:55:00.000Z');
    db.insertSnapshot(old, { ...blank, ts: '2026-09-26T09:55:00.000Z', instrument: nvda.id, venue: 'bstocks', onchainPx: 1, execPx100: 1, shareRatio: 1 });
    const run = db.startRun('2026-09-26T10:00:00.000Z');
    db.insertSnapshot(run, { ...blank, ts: '2026-09-26T10:00:00.000Z', instrument: nvda.id, venue: 'bstocks', onchainPx: 226.9, execPx100: 227.0, shareRatio: 1.000778 });
    db.insertSnapshot(run, { ...blank, ts: '2026-09-26T10:00:00.000Z', instrument: nvda.id, venue: 'xstocks', onchainPx: 226.5, execPx100: null, shareRatio: 1 });
    db.insertEvent({ ts: '2026-09-26T10:00:00.000Z', instrument: nvda.id, venue: 'xstocks', kind: 'QUOTE_EXCLUDED', detail: '40374 at $100' });

    const payload = latestPayload(db, new Date('2026-09-26T10:01:00.000Z'));
    expect(payload.asOf).toBe('2026-09-26T10:00:00.000Z');
    expect(payload.clock.state).toBe('WEEKEND');
    expect(payload.instruments).toHaveLength(5);
    const venues = payload.instruments.find((i) => i.ticker === 'NVDA')!.venues;
    expect(venues.find((v) => v.issuer === 'bstocks')!.snapshot).toMatchObject({ onchain_px: 226.9, exec_px_100: 227.0, share_ratio: 1.000778 });
    expect(venues.find((v) => v.issuer === 'xstocks')!.exclusions).toEqual(['40374 at $100']);
    expect(venues.find((v) => v.issuer === 'ondo')!.snapshot).toBeNull();
    expect(JSON.stringify(payload)).not.toContain('raw_json');
  });
});
