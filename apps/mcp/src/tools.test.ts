import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Gathered, GatherRequest } from '@oneticker/clients';
import type { RouteVenueInput } from '@oneticker/core';
import { describe, expect, it } from 'vitest';
import { createServer } from './server';
import { canonicalJson, checkGateTool, marketStateTool, priceSurfacesTool, quoteRouteTool, RouteStore, routeIdOf, ToolError, type TapeLatest, type ToolDeps } from './tools';

// Sat 26 Sep 2026, 10:12 UTC: US market closed for the weekend.
const SATURDAY = new Date('2026-09-26T10:12:00Z');
// Wed 23 Sep 2026, 15:00 UTC: regular session.
const WEDNESDAY = new Date('2026-09-23T15:00:00Z');

function venue(overrides: Partial<RouteVenueInput>): RouteVenueInput {
  return {
    issuer: 'bstocks',
    symbol: 'NVDAB',
    address: '0x02fca66c1d1afb4e2a7884261eb00f63598a7436',
    shareRatio: 1,
    onchainPx: 228,
    onchainAt: new Date('2026-09-26T10:00:00Z'),
    execPxAtAmount: 228.5,
    execPxAt100: 228.4,
    quoteVendor: 'PcsXRfq',
    quoteError: null,
    oraclePxAtToken: 228.28,
    oracleAt: new Date('2026-09-26T09:37:26Z'),
    multiplierPending: false,
    halted: false,
    ...overrides,
  };
}

const gathered: Gathered = {
  referenceSep: 227.9,
  referenceSource: 'binance-derived',
  venues: [
    venue({ shareRatio: 1.0007782237528078 }),
    venue({ issuer: 'ondo', symbol: 'NVDAon', shareRatio: 1.0017152, execPxAtAmount: 229.1, execPxAt100: 229, oraclePxAtToken: null, oracleAt: null }),
    venue({ issuer: 'xstocks', symbol: 'NVDAx', execPxAtAmount: null, execPxAt100: null, quoteError: '40374', oraclePxAtToken: null, oracleAt: null }),
  ],
};

function fakeDeps(now: Date, tape: TapeLatest | null = null): ToolDeps & { calls: GatherRequest[] } {
  const calls: GatherRequest[] = [];
  return {
    calls,
    gather: async (req) => {
      calls.push(req);
      return structuredClone(gathered);
    },
    tapeLatest: async () => tape,
    now: () => now,
    routes: new RouteStore(),
  };
}

describe('get_market_state', () => {
  it('reports a closed weekend market with the reference age', () => {
    const s = marketStateTool(fakeDeps(SATURDAY), 'nvidia');
    expect(s.state).toBe('WEEKEND');
    expect(s.referenceAgeSec).toBe(14 * 3600 + 12 * 60); // since Fri 20:00 UTC
    expect(s.summary).toMatch(/closed \(weekend\).*14h 12m old/);
  });

  it('reports an open market', () => {
    const s = marketStateTool(fakeDeps(WEDNESDAY), 'NVDA');
    expect(s.state).toBe('REGULAR');
    expect(s.summary).toMatch(/is open/);
  });

  it('rejects instruments outside the registry', () => {
    expect(() => marketStateTool(fakeDeps(SATURDAY), 'AAPL')).toThrow(ToolError);
  });
});

describe('quote_route and check_gate', () => {
  it('ranks by share-equivalent price and explains exclusions', async () => {
    const deps = fakeDeps(SATURDAY);
    const q = await quoteRouteTool(deps, { instrument: 'nvidia', side: 'buy', amountUsd: 500 });
    expect(deps.calls[0]?.instrument.id).toBe('US:NVDA');
    expect(q.routes.map((r) => r.symbol)).toEqual(['NVDAB', 'NVDAon']);
    expect(q.excluded[0]).toMatchObject({ symbol: 'NVDAx', code: '40374' });
    expect(q.best?.symbol).toBe('NVDAB');
    expect(q.routeId).toMatch(/^rt_[0-9a-f]{32}$/);
    expect(q.referenceNote).toMatch(/derived/);
    expect(q).not.toHaveProperty('input');
  });

  it('gives the same input the same routeId, and a different input a different one', async () => {
    const a = await quoteRouteTool(fakeDeps(SATURDAY), { instrument: 'NVDA', side: 'buy', amountUsd: 500 });
    const b = await quoteRouteTool(fakeDeps(SATURDAY), { instrument: 'NVDA', side: 'buy', amountUsd: 500 });
    const c = await quoteRouteTool(fakeDeps(SATURDAY), { instrument: 'NVDA', side: 'buy', amountUsd: 501 });
    expect(a.routeId).toBe(b.routeId);
    expect(c.routeId).not.toBe(a.routeId);
  });

  it('replays the exact verdicts quote_route returned', async () => {
    const deps = fakeDeps(SATURDAY);
    const q = await quoteRouteTool(deps, { instrument: 'NVDA', side: 'buy', amountUsd: 500, includeInput: true });
    const g = checkGateTool(deps, q.routeId);
    expect(g.inputHashMatches).toBe(true);
    expect(g.verdicts.filter((v) => v.status === 'ok').map((v) => [v.symbol, v.verdict, v.reasons])).toEqual(q.routes.map((r) => [r.symbol, r.gate.verdict, r.gate.reasons]));
    expect(g.verdicts.find((v) => v.symbol === 'NVDAx')).toMatchObject({ status: 'excluded', verdict: null });
    expect(routeIdOf(q.input!)).toBe(q.routeId);
    expect(g).not.toHaveProperty('warning');
  });

  it('warns when the replayed quote is stale', async () => {
    let now = SATURDAY;
    const deps = { ...fakeDeps(SATURDAY), now: () => now };
    const q = await quoteRouteTool(deps, { instrument: 'NVDA', side: 'buy', amountUsd: 500 });
    now = new Date(SATURDAY.getTime() + 10 * 60_000);
    expect(checkGateTool(deps, q.routeId).warning).toMatch(/10m old/);
  });

  it('rejects unknown route ids', () => {
    expect(() => checkGateTool(fakeDeps(SATURDAY), `rt_${'0'.repeat(32)}`)).toThrow(/Unknown routeId/);
  });
});

describe('canonicalJson', () => {
  it('ignores key order and renders dates as ISO strings', () => {
    expect(canonicalJson({ b: 1, a: new Date('2026-09-26T10:12:00Z') })).toBe(canonicalJson({ a: new Date('2026-09-26T10:12:00Z'), b: 1 }));
    expect(canonicalJson({ a: [1, { d: null, c: 'x' }] })).toBe('{"a":[1,{"c":"x","d":null}]}');
  });
});

describe('RouteStore', () => {
  it('evicts the oldest route past its limit', async () => {
    const deps = { ...fakeDeps(SATURDAY), routes: new RouteStore(2) };
    const first = await quoteRouteTool(deps, { instrument: 'NVDA', side: 'buy', amountUsd: 100 });
    await quoteRouteTool(deps, { instrument: 'NVDA', side: 'buy', amountUsd: 200 });
    await quoteRouteTool(deps, { instrument: 'NVDA', side: 'buy', amountUsd: 300 });
    expect(deps.routes.get(first.routeId)).toBeUndefined();
  });
});

const tape: TapeLatest = {
  asOf: '2026-09-26T10:10:00.000Z',
  instruments: [
    {
      id: 'US:NVDA',
      venues: [
        {
          issuer: 'bstocks',
          symbol: 'NVDAB',
          exclusions: [],
          snapshot: {
            ts: '2026-09-26T10:10:00.000Z',
            onchain_px: 228,
            exec_px_100: 200,
            exec_px_1k: 201,
            exec_px_10k: 202,
            oracle_px: 198,
            oracle_updated_at: '2026-09-26T09:10:00.000Z',
            share_ratio: 2,
          },
        },
        {
          issuer: 'ondo',
          symbol: 'NVDAon',
          exclusions: [],
          snapshot: { ts: '2026-09-26T10:10:00.000Z', onchain_px: 101, exec_px_100: 101, exec_px_1k: null, exec_px_10k: null, oracle_px: null, oracle_updated_at: null, share_ratio: 1 },
        },
        { issuer: 'xstocks', symbol: 'NVDAx', exclusions: ['40374 at $100'], snapshot: null },
      ],
    },
  ],
};

describe('get_price_surfaces', () => {
  it('normalizes every surface to one share and derives the metrics', async () => {
    const s = await priceSurfacesTool(fakeDeps(SATURDAY, tape), 'NVDA');
    const [b, o, x] = s.venues;
    expect(b?.sep).toEqual({ onchain: 114, executable100: 100, executable1k: 100.5, executable10k: 101, oracle: 99 });
    expect(b?.impactBps).toBeCloseTo(100);
    expect(b?.oracleDivergenceBps).toBeCloseTo((100 / 99 - 1) * 10_000);
    expect(b?.oracleAgeSec).toBe(3720);
    expect(o?.sep.executable100).toBe(101);
    expect(x?.exclusions).toEqual(['40374 at $100']);
    expect(s.cheapestAt100).toBe('NVDAB');
    expect(s.crossIssuerSpreadBps).toBeCloseTo(100);
    expect(s.snapshotAgeSec).toBe(120);
    expect(s.reference).toBeNull();
  });

  it('fails clearly when the Tape is unreachable', async () => {
    await expect(priceSurfacesTool(fakeDeps(SATURDAY, null), 'NVDA')).rejects.toThrow(/no data/);
  });
});

describe('MCP server', () => {
  async function connect(deps: ToolDeps) {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer(deps).connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    return client;
  }
  const textOf = (r: Awaited<ReturnType<Client['callTool']>>) => (r.content as { type: string; text: string }[])[0]!.text;

  it('lists the five read tools, all marked read-only', async () => {
    const client = await connect(fakeDeps(SATURDAY));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['check_gate', 'get_market_state', 'get_price_surfaces', 'quote_route', 'resolve_instrument']);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
    expect(client.getInstructions()).toMatch(/resolve_instrument instead of asking/);
  });

  it('quotes and replays over the protocol', async () => {
    const client = await connect(fakeDeps(SATURDAY));
    const quote = JSON.parse(textOf(await client.callTool({ name: 'quote_route', arguments: { instrument: 'NVDAon', side: 'buy', amountUsd: 500 } })));
    expect(quote.best.symbol).toBe('NVDAB');
    const gate = JSON.parse(textOf(await client.callTool({ name: 'check_gate', arguments: { routeId: quote.routeId } })));
    expect(gate.inputHashMatches).toBe(true);
  });

  it('returns tool errors as isError results, not protocol failures', async () => {
    const client = await connect(fakeDeps(SATURDAY));
    const r = await client.callTool({ name: 'resolve_instrument', arguments: { query: 'AAPL' } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/OneTicker covers NVDA/);
  });

  it('validates arguments', async () => {
    const client = await connect(fakeDeps(SATURDAY));
    const r = await client.callTool({ name: 'quote_route', arguments: { instrument: 'NVDA', side: 'hold', amountUsd: -5 } });
    expect(r.isError).toBe(true);
  });
});
