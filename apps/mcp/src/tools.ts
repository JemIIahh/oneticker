// Tool logic for the MCP server (SPEC 4), kept apart from the SDK wiring so it can be tested with fake I/O.
// Read tools only: nothing here signs or sends a transaction.

import { createHash } from 'node:crypto';
import type { Gathered, GatherRequest } from '@oneticker/clients';
import {
  bps,
  formatDuration,
  instruments,
  marketClock,
  quoteRoute,
  resolveInstrument,
  type Issuer,
  type QuoteRouteInput,
  type QuoteRouteResult,
  type Resolution,
} from '@oneticker/core';

/** One venue's row in the Tape's `/api/latest` (apps/tape/src/api.ts). Prices are USD per raw token. */
export interface TapeSnapshot {
  ts: string;
  onchain_px: number | null;
  exec_px_100: number | null;
  exec_px_1k: number | null;
  exec_px_10k: number | null;
  oracle_px: number | null;
  oracle_updated_at: string | null;
  share_ratio: number | null;
}

export interface TapeLatest {
  asOf: string | null;
  instruments: { id: string; venues: { issuer: Issuer; symbol: string; snapshot: TapeSnapshot | null; exclusions: string[] }[] }[];
}

export interface ToolDeps {
  gather(req: GatherRequest): Promise<Gathered>;
  /** The Tape's newest run, or null when it cannot be reached. */
  tapeLatest(): Promise<TapeLatest | null>;
  now(): Date;
  routes: RouteStore;
}

export class ToolError extends Error {}

// ---------- resolve_instrument ----------

function describe(r: Resolution) {
  return {
    id: r.instrument.id,
    ticker: r.instrument.ticker,
    name: r.instrument.name,
    matchedOn: r.matchedOn,
    requestedVenue: r.venue ? { issuer: r.venue.issuer, symbol: r.venue.symbol } : null,
    venues: r.instrument.venues.map((v) => ({ issuer: v.issuer, symbol: v.symbol, address: v.address, decimals: v.decimals, path: v.path })),
  };
}

function mustResolve(query: string): Resolution {
  const r = resolveInstrument(instruments, query);
  if (!r) throw new ToolError(`No instrument matches "${query}". OneTicker covers ${instruments.map((i) => `${i.ticker} (${i.name})`).join(', ')}.`);
  return r;
}

export function resolveTool(query: string) {
  return describe(mustResolve(query));
}

// ---------- get_market_state ----------

export function marketStateTool(deps: ToolDeps, query: string) {
  const { instrument } = mustResolve(query);
  const now = deps.now();
  const clock = marketClock(now);
  const open = clock.state === 'REGULAR';
  const summary = open
    ? `US regular session is open; it closes in ${formatDuration((clock.nextClose.getTime() - now.getTime()) / 1000)}.`
    : `US regular session is closed (${clock.state.toLowerCase()}). The last real reference price is ${formatDuration(clock.referenceAgeSec)} old; ` +
      `the market opens in ${formatDuration((clock.nextOpen.getTime() - now.getTime()) / 1000)}.`;
  return { instrument: instrument.id, now: now.toISOString(), ...clock, summary };
}

// ---------- get_price_surfaces ----------

const sepOf = (px: number | null, ratio: number | null) => (px !== null && ratio !== null && ratio > 0 ? px / ratio : null);
const bpsOrNull = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? bps(a, b) : null);

export async function priceSurfacesTool(deps: ToolDeps, query: string) {
  const { instrument } = mustResolve(query);
  const latest = await deps.tapeLatest();
  const row = latest?.instruments.find((i) => i.id === instrument.id);
  if (!latest?.asOf || !row) throw new ToolError('The Tape (the 5-minute price recorder) has no data right now. Try quote_route for a live quote.');

  const now = deps.now();
  const venues = row.venues.map((v) => {
    const s = v.snapshot;
    const ratio = s?.share_ratio ?? null;
    const exec100 = sepOf(s?.exec_px_100 ?? null, ratio);
    const exec10k = sepOf(s?.exec_px_10k ?? null, ratio);
    const oracle = sepOf(s?.oracle_px ?? null, ratio);
    const oracleAt = s?.oracle_updated_at ? new Date(s.oracle_updated_at) : null;
    return {
      issuer: v.issuer,
      symbol: v.symbol,
      sharesPerToken: ratio,
      sep: {
        onchain: sepOf(s?.onchain_px ?? null, ratio),
        executable100: exec100,
        executable1k: sepOf(s?.exec_px_1k ?? null, ratio),
        executable10k: exec10k,
        oracle,
      },
      oracleAgeSec: oracleAt ? Math.max(0, Math.round((now.getTime() - oracleAt.getTime()) / 1000)) : null,
      impactBps: bpsOrNull(exec10k, exec100),
      oracleDivergenceBps: bpsOrNull(exec100, oracle),
      exclusions: v.exclusions,
    };
  });

  const executable = venues.filter((v) => v.sep.executable100 !== null).sort((a, b) => a.sep.executable100! - b.sep.executable100!);
  const cheapest = executable[0];
  const richest = executable.at(-1);
  return {
    instrument: instrument.id,
    snapshotAt: latest.asOf,
    snapshotAgeSec: Math.max(0, Math.round((now.getTime() - Date.parse(latest.asOf)) / 1000)),
    clock: marketClock(now),
    reference: null,
    referenceNote: "No independent equity quote yet. Binance's referencePrice is derived from the token price, so it is not used as a reference.",
    crossIssuerSpreadBps: cheapest && richest && executable.length > 1 ? bps(richest.sep.executable100!, cheapest.sep.executable100!) : null,
    cheapestAt100: cheapest?.symbol ?? null,
    venues,
    units: 'SEP = USD per one underlying share. Every price is normalized before comparison.',
  };
}

// ---------- quote_route and check_gate ----------

/** JSON with sorted keys and ISO dates, so the same input always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A route id is the hash of everything the gate saw, so a verdict can be replayed and checked, not just trusted. */
export const routeIdOf = (input: QuoteRouteInput) => `rt_${createHash('sha256').update(canonicalJson(input)).digest('hex').slice(0, 32)}`;

export class RouteStore {
  private readonly routes = new Map<string, QuoteRouteInput>();
  constructor(private readonly max = 1000) {}

  put(input: QuoteRouteInput): string {
    const id = routeIdOf(input);
    this.routes.delete(id);
    this.routes.set(id, input);
    while (this.routes.size > this.max) this.routes.delete(this.routes.keys().next().value!);
    return id;
  }

  get(id: string): QuoteRouteInput | undefined {
    return this.routes.get(id);
  }
}

export async function quoteRouteTool(deps: ToolDeps, args: { instrument: string; side: 'buy' | 'sell'; amountUsd: number; includeInput?: boolean }) {
  const { instrument } = mustResolve(args.instrument);
  const gathered = await deps.gather({ instrument, side: args.side, amountUsd: args.amountUsd });
  const input: QuoteRouteInput = {
    ticker: instrument.ticker,
    side: args.side,
    amountUsd: args.amountUsd,
    referenceSep: gathered.referenceSep,
    venues: gathered.venues,
    now: deps.now(),
  };
  const routeId = deps.routes.put(input);
  const result = quoteRoute(input);
  return {
    routeId,
    ...summarize(result),
    referenceSource: gathered.referenceSource,
    ...(gathered.referenceSource === 'binance-derived'
      ? { referenceNote: "Reference is Binance's referencePrice, which is derived from the token's own price; premiums against it are not an independent check." }
      : {}),
    ...(args.includeInput ? { input } : {}),
  };
}

function summarize(result: QuoteRouteResult) {
  return {
    instrument: result.ticker,
    side: result.side,
    amountUsd: result.amountUsd,
    asOf: result.asOf,
    marketState: result.clock.state,
    referenceAgeSec: result.clock.referenceAgeSec,
    referenceSep: result.referenceSep,
    best: result.routes[0] ? { symbol: result.routes[0].symbol, issuer: result.routes[0].issuer, verdict: result.routes[0].gate.verdict } : null,
    routes: result.routes,
    excluded: result.excluded,
  };
}

/** Replays the deterministic gate on the exact input a quote_route call saw. Same input, same verdict, every time. */
export function checkGateTool(deps: ToolDeps, routeId: string) {
  const input = deps.routes.get(routeId);
  if (!input) throw new ToolError(`Unknown routeId "${routeId}". Route ids live in this server's memory; call quote_route again.`);
  const result = quoteRoute(input);
  const quotedAt = input.now ?? new Date(result.asOf);
  const quoteAgeSec = Math.max(0, Math.round((deps.now().getTime() - quotedAt.getTime()) / 1000));
  return {
    routeId,
    inputHashMatches: routeIdOf(input) === routeId,
    quotedAt: result.asOf,
    quoteAgeSec,
    ...(quoteAgeSec > 60 ? { warning: `This quote is ${formatDuration(quoteAgeSec)} old. Prices move; call quote_route again before acting on it.` } : {}),
    verdicts: [
      ...result.routes.map((r) => ({ symbol: r.symbol, issuer: r.issuer, status: r.status, verdict: r.gate.verdict, reasons: r.gate.reasons, policy: r.gate.policy })),
      ...result.excluded.map((e) => ({ symbol: e.symbol, issuer: e.issuer, status: e.status, verdict: null, reasons: [{ code: e.code, detail: e.reason }], policy: null })),
    ],
  };
}

