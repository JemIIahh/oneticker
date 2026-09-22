// Read-only HTTP API over the Tape, for the web terminal (T13) and anyone else. No auth: the data is public.
//
//   GET /health                                  -> { ok, lastRun }
//   GET /api/latest                              -> newest run: every instrument and venue, plus quote exclusions
//   GET /api/history?instrument=US:NVDA&hours=72 -> rows for one instrument, oldest first

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { instruments, marketClock } from '@oneticker/core';
import type { TapeDb } from './db';

const MAX_HOURS = 24 * 21;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=30',
  });
  res.end(JSON.stringify(body));
}

export function latestPayload(db: TapeDb, now = new Date()) {
  const rows = db.latestSnapshots();
  const events = db.latestEvents();
  const asOf = rows[0]?.ts ?? null;
  return {
    asOf,
    now: now.toISOString(),
    clock: marketClock(now),
    instruments: instruments.map((instrument) => ({
      id: instrument.id,
      ticker: instrument.ticker,
      name: instrument.name,
      venues: instrument.venues.map((venue) => {
        const row = rows.find((r) => r.instrument === instrument.id && r.venue === venue.issuer) ?? null;
        const exclusions = events.filter((e) => e.instrument === instrument.id && e.venue === venue.issuer && e.kind === 'QUOTE_EXCLUDED').map((e) => e.detail);
        return { issuer: venue.issuer, symbol: venue.symbol, address: venue.address, path: venue.path, snapshot: row, exclusions };
      }),
    })),
  };
}

export function handle(db: TapeDb, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://tape');
  if (req.method !== 'GET') return json(res, 405, { error: 'GET only' });

  if (url.pathname === '/health') {
    const last = db.latestSnapshots()[0]?.ts ?? null;
    return json(res, 200, { ok: true, lastRun: last });
  }
  if (url.pathname === '/api/latest') return json(res, 200, latestPayload(db));
  if (url.pathname === '/api/history') {
    const instrument = url.searchParams.get('instrument') ?? '';
    if (!instruments.some((i) => i.id === instrument)) return json(res, 400, { error: `unknown instrument; one of ${instruments.map((i) => i.id).join(', ')}` });
    const hours = Math.min(MAX_HOURS, Math.max(1, Number(url.searchParams.get('hours') ?? 72) || 72));
    const from = new Date(Date.now() - hours * 3_600_000).toISOString();
    return json(res, 200, { instrument, from, rows: db.historySince(instrument, from) });
  }
  return json(res, 404, { error: 'not found' });
}

export function startApi(db: TapeDb, port: number): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    try {
      handle(db, req, res);
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.listen(port, () => console.log(`TAPE_API ${JSON.stringify({ port })}`));
  return server;
}
