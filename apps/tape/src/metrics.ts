// API call metrics (T15): latency and error rates per endpoint, and error-code counts, from the Tape's api_calls table.
// Pure functions; metrics-cli.ts reads the databases and writes dx/metrics.md.

import { quantile } from './analysis';

export interface CallRow {
  endpoint: string;
  http_status: number;
  latency_ms: number;
  error_code: string | null;
}

export interface EndpointMetrics {
  endpoint: string;
  calls: number;
  /** Calls that came back HTTP 200 with no error code. */
  ok: number;
  /** Latency of the successful calls only, in ms. */
  p50: number | null;
  p95: number | null;
}

export interface ErrorCount {
  status: number;
  code: string;
  count: number;
  medianMs: number | null;
}

export interface Metrics {
  from: string;
  to: string;
  calls: number;
  endpoints: EndpointMetrics[];
  errors: ErrorCount[];
}

/** The path without host-specific query noise, so one endpoint is one row. */
export function endpointKey(endpoint: string): string {
  return endpoint.split('?')[0]!;
}

export const isOk = (r: CallRow): boolean => r.http_status === 200 && r.error_code === null;

export function summarize(rows: (CallRow & { ts: string })[]): Metrics {
  const byEndpoint = new Map<string, CallRow[]>();
  const byError = new Map<string, CallRow[]>();
  for (const r of rows) {
    const key = endpointKey(r.endpoint);
    (byEndpoint.get(key) ?? byEndpoint.set(key, []).get(key)!).push(r);
    if (!isOk(r)) {
      const k = `${r.http_status}|${r.error_code ?? '-'}`;
      (byError.get(k) ?? byError.set(k, []).get(k)!).push(r);
    }
  }
  const times = rows.map((r) => r.ts).sort();
  return {
    from: times[0] ?? '',
    to: times[times.length - 1] ?? '',
    calls: rows.length,
    endpoints: [...byEndpoint.entries()]
      .map(([endpoint, rs]) => {
        const okLat = rs.filter(isOk).map((r) => r.latency_ms);
        return { endpoint, calls: rs.length, ok: okLat.length, p50: quantile(okLat, 0.5), p95: quantile(okLat, 0.95) };
      })
      .sort((a, b) => b.calls - a.calls),
    errors: [...byError.entries()]
      .map(([k, rs]) => {
        const [status, code] = k.split('|');
        return { status: Number(status), code: code!, count: rs.length, medianMs: quantile(rs.map((r) => r.latency_ms), 0.5) };
      })
      .sort((a, b) => b.count - a.count),
  };
}

export interface Section {
  title: string;
  note: string;
  metrics: Metrics;
}

const ms = (x: number | null) => (x === null ? 'n/a' : Math.round(x).toLocaleString('en-US'));

export function renderMetrics(sections: Section[], generatedAt: string): string {
  const out = ['# API metrics (generated)', '', `Generated ${generatedAt} by \`pnpm --filter tape metrics\` from the Tape's \`api_calls\` table. Do not edit by hand.`, ''];
  for (const s of sections) {
    const m = s.metrics;
    out.push(`## ${s.title}`, '', s.note, '', `${m.calls.toLocaleString('en-US')} calls, ${m.from} to ${m.to} UTC.`, '');
    out.push('| Endpoint | Calls | Succeeded | p50 ms | p95 ms |', '| --- | --- | --- | --- | --- |');
    for (const e of m.endpoints) out.push(`| \`${e.endpoint}\` | ${e.calls.toLocaleString('en-US')} | ${((100 * e.ok) / e.calls).toFixed(1)}% | ${ms(e.p50)} | ${ms(e.p95)} |`);
    out.push('', 'Latency is for successful calls only. Failed calls, by HTTP status and error code (status 0 means no response arrived):', '');
    out.push('| HTTP status | Code | Calls | Median ms |', '| --- | --- | --- | --- |');
    for (const e of m.errors) out.push(`| ${e.status} | ${e.code} | ${e.count.toLocaleString('en-US')} | ${ms(e.medianMs)} |`);
    out.push('');
  }
  return out.join('\n');
}
