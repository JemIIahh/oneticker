// Tape analysis (T15): what the recorded prices say about weekends. Pure functions over samples; analyze.ts does the I/O.
//
// A sample is one Tape run for one instrument. Every price here is USD per underlying share (SEP): a token price
// divided by that venue's shares-per-token ratio. The 24/7 TradFi perpetual is the only live price of the stock while
// Wall Street is closed, so it is the yardstick for the off-hours numbers. It is not ground truth: there is no equity
// reference in the Tape yet (Finnhub is pending), and a perp carries its own basis.

import { checkGate, defaultPolicy, marketClock, type GateInput, type MarketClock, type Verdict } from '@oneticker/core';

export type Issuer = 'bstocks' | 'ondo' | 'xstocks';
export type Group = 'open' | 'weeknight' | 'weekend';
export const GROUPS: Group[] = ['open', 'weeknight', 'weekend'];
export const SIZES = ['100', '1k', '10k'] as const;
export type Size = (typeof SIZES)[number];

export interface VenueSample {
  /** Shares per token. Null means a token price cannot be turned into a share price. */
  ratio: number | null;
  exec: Record<Size, number | null>;
  pool: number | null;
  /** On-chain token price, the source of Binance's derived reference. */
  onchainPx: number | null;
  oraclePx: number | null;
  oracleUpdatedAt: string | null;
}

export interface Sample {
  ts: string;
  instrument: string;
  perp: number | null;
  venues: Partial<Record<Issuer, VenueSample>>;
}

export interface Quantiles {
  n: number;
  mean: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

/** Nearest-rank quantile on a sorted copy. Null for an empty list. */
export function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}

export function quantiles(values: number[]): Quantiles {
  const mean = values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
  return { n: values.length, mean, p10: quantile(values, 0.1), p50: quantile(values, 0.5), p90: quantile(values, 0.9) };
}

const bps = (a: number, b: number): number => (a / b - 1) * 10_000;

/** open: US regular session. weekend: closed with more than 48 hours between close and next open. Otherwise weeknight. */
export function groupOf(ts: string): Group {
  const clock = marketClock(new Date(ts));
  if (clock.state === 'REGULAR') return 'open';
  return clock.nextOpen.getTime() - clock.lastClose.getTime() > 48 * 3_600_000 ? 'weekend' : 'weeknight';
}

/** Share-equivalent price of a token price, or null when the ratio is unknown. */
export function sep(tokenPx: number | null, ratio: number | null): number | null {
  return tokenPx !== null && ratio !== null && ratio > 0 ? tokenPx / ratio : null;
}

const execSep = (v: VenueSample | undefined, size: Size): number | null => (v ? sep(v.exec[size], v.ratio) : null);

export interface GroupCoverage {
  samples: number;
  perp: number;
  pool: number;
  oracle: number;
  quote100: number;
  xstocksQuote100: number;
}
export interface IssuerSpread {
  /** Samples where both bStocks and Ondo quoted this size. */
  n: number;
  bstocksCheapest: number;
  /** Regret of always choosing one issuer: how much more it charged per share than the cheaper of the two, in bps. */
  regretBstocks: Quantiles;
  regretOndo: Quantiles;
  /** Share of samples where Ondo charged more than 10% above the cheaper issuer. */
  ondoOver10pct: number;
}
export interface GateReplay {
  n: number;
  verdicts: Record<Verdict, number>;
  reasons: Record<string, number>;
}
export interface Findings {
  window: { from: string; to: string; samples: number; runs: number; instruments: number };
  coverage: Record<Group, GroupCoverage>;
  issuerSpread: Record<Size, Record<Group, IssuerSpread>>;
  /** On-chain PancakeSwap pool price against the perp, bps. Positive: the pool is above the perp. */
  poolVsPerp: Record<Group, Quantiles & { beyondPremiumCaution: number; maxAbs: number | null }>;
  poolVsPerpByInstrument: Record<string, Record<Group, Quantiles>>;
  /** APRO oracle price against the perp, bps. */
  oracleVsPerp: Record<Group, Quantiles & { beyondCaution: number; beyondBlock: number; maxAbs: number | null }>;
  oracleAgeMin: Record<Group, Quantiles>;
  /** The shipped gate (perp cross-check included) on the cheapest $1,000 route in each sample. */
  gateReplay: Record<Group, GateReplay>;
  /** Share of closed-market samples where the shipped gate's reference-age rule fires on its own (clock only). */
  refStaleShareClosed: number;
}

const perGroup = <T>(make: () => T): Record<Group, T> => ({ open: make(), weeknight: make(), weekend: make() });

/**
 * The cheapest quoted route at $1,000 as the gate saw routes at the time: Binance's derived reference (the venue's own
 * on-chain price per share, as the router uses it), the market clock's reference age, and the 24/7 perp cross-check.
 */
function replayInput(s: Sample, clock: MarketClock): GateInput | null {
  let best: { issuer: Issuer; px: number } | null = null;
  for (const issuer of ['bstocks', 'ondo', 'xstocks'] as const) {
    const px = execSep(s.venues[issuer], '1k');
    if (px !== null && (best === null || px < best.px)) best = { issuer, px };
  }
  if (best === null) return null;
  const v = s.venues[best.issuer]!;
  const oracleSep = sep(v.oraclePx, v.ratio);
  const oracleAgeSec = v.oracleUpdatedAt ? Math.max(0, (Date.parse(s.ts) - Date.parse(v.oracleUpdatedAt)) / 1000) : null;
  const reference = sep(s.venues.bstocks?.onchainPx ?? null, s.venues.bstocks?.ratio ?? null) ?? sep(v.onchainPx, v.ratio);
  return {
    side: 'buy',
    marketState: clock.state,
    referenceAgeSec: clock.referenceAgeSec,
    referenceSep: reference,
    executableSep: best.px,
    executableSep100: execSep(v, '100'),
    oracleSep,
    oracleAgeSec: oracleSep === null ? null : oracleAgeSec,
    ...(s.perp !== null ? { perpSep: s.perp } : {}),
    multiplierPending: false,
    halted: false,
  };
}

export function analyze(samples: Sample[], runs: number): Findings {
  const coverage = perGroup<GroupCoverage>(() => ({ samples: 0, perp: 0, pool: 0, oracle: 0, quote100: 0, xstocksQuote100: 0 }));
  const spreadAcc = Object.fromEntries(SIZES.map((z) => [z, perGroup(() => ({ n: 0, bWins: 0, regB: [] as number[], regO: [] as number[] }))])) as Record<Size, Record<Group, { n: number; bWins: number; regB: number[]; regO: number[] }>>;
  const poolAcc = perGroup(() => [] as number[]);
  const poolByInst: Record<string, Record<Group, number[]>> = {};
  const oracleAcc = perGroup(() => [] as number[]);
  const ageAcc = perGroup(() => [] as number[]);
  const replay = perGroup<GateReplay>(() => ({ n: 0, verdicts: { GO: 0, CAUTION: 0, BLOCK: 0 }, reasons: {} }));
  let closed = 0;
  let refStale = 0;

  for (const s of samples) {
    const clock = marketClock(new Date(s.ts));
    const g = groupOf(s.ts);
    const b = s.venues.bstocks;
    const cov = coverage[g];
    cov.samples++;
    if (s.perp !== null) cov.perp++;
    const pool = b ? sep(b.pool, b.ratio) : null;
    const oracle = b ? sep(b.oraclePx, b.ratio) : null;
    if (pool !== null) cov.pool++;
    if (oracle !== null) cov.oracle++;
    if (Object.values(s.venues).some((v) => v && sep(v.exec['100'], v.ratio) !== null)) cov.quote100++;
    if (sep(s.venues.xstocks?.exec['100'] ?? null, s.venues.xstocks?.ratio ?? null) !== null) cov.xstocksQuote100++;

    for (const z of SIZES) {
      const pb = execSep(s.venues.bstocks, z);
      const po = execSep(s.venues.ondo, z);
      if (pb === null || po === null) continue;
      const acc = spreadAcc[z][g];
      acc.n++;
      if (pb <= po) acc.bWins++;
      const best = Math.min(pb, po);
      acc.regB.push(bps(pb, best));
      acc.regO.push(bps(po, best));
    }

    if (s.perp !== null && pool !== null) {
      const d = bps(pool, s.perp);
      poolAcc[g].push(d);
      (poolByInst[s.instrument] ??= perGroup(() => []))[g].push(d);
    }
    if (s.perp !== null && oracle !== null) oracleAcc[g].push(bps(oracle, s.perp));
    if (b?.oracleUpdatedAt && oracle !== null) ageAcc[g].push(Math.max(0, (Date.parse(s.ts) - Date.parse(b.oracleUpdatedAt)) / 60_000));

    if (g !== 'open') {
      closed++;
      if (clock.referenceAgeSec > defaultPolicy.referenceAgeSec.caution) refStale++;
    }
    const input = replayInput(s, clock);
    if (input) {
      const res = checkGate(input);
      replay[g].n++;
      replay[g].verdicts[res.verdict]++;
      for (const r of res.reasons) replay[g].reasons[r.code] = (replay[g].reasons[r.code] ?? 0) + 1;
    }
  }

  const share = (xs: number[], test: (x: number) => boolean) => (xs.length === 0 ? 0 : xs.filter(test).length / xs.length);
  const maxAbs = (xs: number[]) => (xs.length === 0 ? null : Math.max(...xs.map(Math.abs)));
  const times = samples.map((s) => s.ts).sort();
  return {
    window: { from: times[0] ?? '', to: times[times.length - 1] ?? '', samples: samples.length, runs, instruments: new Set(samples.map((s) => s.instrument)).size },
    coverage,
    issuerSpread: Object.fromEntries(
      SIZES.map((z) => [z, Object.fromEntries(GROUPS.map((g) => [g, { n: spreadAcc[z][g].n, bstocksCheapest: spreadAcc[z][g].n ? spreadAcc[z][g].bWins / spreadAcc[z][g].n : 0, regretBstocks: quantiles(spreadAcc[z][g].regB), regretOndo: quantiles(spreadAcc[z][g].regO), ondoOver10pct: share(spreadAcc[z][g].regO, (x) => x > 1000) }]))]),
    ) as Findings['issuerSpread'],
    poolVsPerp: Object.fromEntries(GROUPS.map((g) => [g, { ...quantiles(poolAcc[g]), beyondPremiumCaution: share(poolAcc[g], (x) => Math.abs(x) > defaultPolicy.premiumBps.caution), maxAbs: maxAbs(poolAcc[g]) }])) as Findings['poolVsPerp'],
    poolVsPerpByInstrument: Object.fromEntries(Object.entries(poolByInst).map(([k, v]) => [k, Object.fromEntries(GROUPS.map((g) => [g, quantiles(v[g])]))])) as Findings['poolVsPerpByInstrument'],
    oracleVsPerp: Object.fromEntries(
      GROUPS.map((g) => [g, { ...quantiles(oracleAcc[g]), beyondCaution: share(oracleAcc[g], (x) => Math.abs(x) > defaultPolicy.oracleDivergenceBps.caution), beyondBlock: share(oracleAcc[g], (x) => Math.abs(x) > (defaultPolicy.oracleDivergenceBps.block ?? Infinity)), maxAbs: maxAbs(oracleAcc[g]) }]),
    ) as Findings['oracleVsPerp'],
    oracleAgeMin: Object.fromEntries(GROUPS.map((g) => [g, quantiles(ageAcc[g])])) as Findings['oracleAgeMin'],
    gateReplay: replay,
    refStaleShareClosed: closed === 0 ? 0 : refStale / closed,
  };
}

export interface SeriesPoint {
  t: number;
  perp: number | null;
  pool: number | null;
  quote: number | null;
}

/** One instrument's per-share series averaged into fixed buckets, for the /tape chart. */
export function series(samples: Sample[], instrument: string, bucketMin: number): SeriesPoint[] {
  const width = bucketMin * 60_000;
  const acc = new Map<number, { perp: number[]; pool: number[]; quote: number[] }>();
  for (const s of samples) {
    if (s.instrument !== instrument) continue;
    const key = Math.floor(Date.parse(s.ts) / width) * width;
    const a = acc.get(key) ?? acc.set(key, { perp: [], pool: [], quote: [] }).get(key)!;
    if (s.perp !== null) a.perp.push(s.perp);
    const b = s.venues.bstocks;
    const pool = b ? sep(b.pool, b.ratio) : null;
    if (pool !== null) a.pool.push(pool);
    const quotes = (['bstocks', 'ondo', 'xstocks'] as const).map((i) => execSep(s.venues[i], '100')).filter((x): x is number => x !== null);
    if (quotes.length > 0) a.quote.push(Math.min(...quotes));
  }
  const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((x, y) => x + y, 0) / xs.length);
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, a]) => ({ t, perp: mean(a.perp), pool: mean(a.pool), quote: mean(a.quote) }));
}
