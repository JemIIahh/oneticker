import { afterEach, describe, expect, it } from 'vitest';
import type { Instrument } from '@oneticker/core';
import type { Collect } from './collect';
import { openTape, type TapeDb } from './db';
import { runOnce } from './run';

const NVDA: Instrument = {
  id: 'US:NVDA',
  ticker: 'NVDA',
  name: 'NVIDIA',
  venues: [
    { issuer: 'bstocks', symbol: 'NVDAB', address: '0x0000000000000000000000000000000000000001', decimals: 18, path: 'RFQ_BSTOCK' },
    { issuer: 'ondo', symbol: 'NVDAon', address: '0x0000000000000000000000000000000000000002', decimals: 18, path: 'RFQ_ONDO' },
  ],
};

const fixedNow = (iso: string) => () => new Date(iso);

describe('runOnce', () => {
  let db: TapeDb;
  afterEach(() => db.close());

  it('writes one snapshot per venue with its raw data and a successful run', async () => {
    db = openTape(':memory:');
    const collect: Collect = async (instruments) =>
      instruments.flatMap((instrument) =>
        instrument.venues.map((venue) => ({
          instrument,
          venue,
          oracle: venue.issuer === 'bstocks' ? ({ price: 226.9, updatedAt: new Date('2026-09-26T10:25:55.000Z') } as never) : null,
          multiplier: venue.issuer === 'bstocks' ? ({ multiplier: 1.0007 } as never) : null,
          raw: { rwaPrice: null, marketPrice: null, underlyingMarket: null, quotes: { '100': { at: 'x', ok: true as const, envelope: { symbol: venue.symbol } } }, oracle: null, multiplier: null },
        })),
      );
    const lines: string[] = [];

    const summary = await runOnce({ db, instruments: [NVDA], collect, marketState: () => 'WEEKEND', now: fixedNow('2026-09-26T12:00:00.000Z'), log: (l) => lines.push(l) });

    expect(summary).toMatchObject({ ok: true, snapshots: 2, error: null });
    const rows = db.raw.prepare('SELECT instrument, venue, market_state, oracle_px, oracle_updated_at, share_ratio, raw_json FROM snapshots ORDER BY venue').all() as {
      instrument: string;
      venue: string;
      market_state: string;
      oracle_px: number | null;
      oracle_updated_at: string | null;
      share_ratio: number | null;
      raw_json: string;
    }[];
    expect(rows.map((r) => [r.instrument, r.venue, r.market_state, r.oracle_px, r.oracle_updated_at, r.share_ratio])).toEqual([
      ['US:NVDA', 'bstocks', 'WEEKEND', 226.9, '2026-09-26T10:25:55.000Z', 1.0007],
      ['US:NVDA', 'ondo', 'WEEKEND', null, null, null],
    ]);
    expect(JSON.parse(rows[0]!.raw_json).quotes['100'].envelope).toEqual({ symbol: 'NVDAB' });
    expect(db.runsBetween('2026-09-26T00:00:00.000Z', '2026-09-27T00:00:00.000Z')).toMatchObject([{ ok: 1, snapshots: 2, error: null }]);
    expect(lines[0]).toMatch(/^RUN \{/);
  });

  it('records a failed run and a RUN_FAILED line when collection throws', async () => {
    db = openTape(':memory:');
    const lines: string[] = [];
    const collect: Collect = async () => {
      throw new Error('keys not set');
    };

    const summary = await runOnce({ db, instruments: [NVDA], collect, now: fixedNow('2026-09-26T12:00:00.000Z'), log: (l) => lines.push(l) });

    expect(summary).toMatchObject({ ok: false, snapshots: 0, error: 'keys not set' });
    expect(db.runsBetween('2026-09-26T00:00:00.000Z', '2026-09-27T00:00:00.000Z')).toMatchObject([{ ok: 0, error: 'keys not set' }]);
    expect(lines[0]).toMatch(/^RUN_FAILED \{.*keys not set/);
  });

  it('fails loudly when the registry is empty', async () => {
    db = openTape(':memory:');
    const summary = await runOnce({ db, instruments: [], collect: async () => [], log: () => {} });
    expect(summary.error).toMatch(/registry is empty/);
  });
});
