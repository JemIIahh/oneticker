import { describe, expect, it } from 'vitest';
import { endpointKey, renderMetrics, summarize } from './metrics';

const call = (endpoint: string, http_status: number, latency_ms: number, error_code: string | null = null, ts = '2026-10-01T10:00:00.000Z') => ({ ts, endpoint, http_status, latency_ms, error_code });

describe('summarize', () => {
  it('computes latency over successful calls only and counts failures by status and code', () => {
    const m = summarize([
      call('/api/v1/dex/aggregator/quote', 200, 100),
      call('/api/v1/dex/aggregator/quote', 200, 300),
      call('/api/v1/dex/aggregator/quote', 200, 900, '40374'),
      call('/api/v1/dex/aggregator/quote', 0, 5000, 'TIMEOUT'),
      call('/api/v1/dex/market/rwa/price', 200, 50),
    ]);
    const quote = m.endpoints.find((e) => e.endpoint === '/api/v1/dex/aggregator/quote')!;
    expect(quote).toMatchObject({ calls: 4, ok: 2, p50: 300 });
    expect(m.errors).toEqual([
      { status: 200, code: '40374', count: 1, medianMs: 900 },
      { status: 0, code: 'TIMEOUT', count: 1, medianMs: 5000 },
    ]);
    expect(m.endpoints[0]!.endpoint).toBe('/api/v1/dex/aggregator/quote'); // most calls first
  });

  it('treats an HTTP 200 with an error code as a failure and drops query strings', () => {
    expect(endpointKey('/api/v1/dex/x?a=1&b=2')).toBe('/api/v1/dex/x');
    const m = summarize([call('/p?a=1', 200, 10, '40001'), call('/p?a=2', 200, 20)]);
    expect(m.endpoints).toHaveLength(1);
    expect(m.endpoints[0]).toMatchObject({ calls: 2, ok: 1 });
  });

  it('handles no calls', () => {
    expect(summarize([])).toMatchObject({ calls: 0, endpoints: [], errors: [], from: '', to: '' });
  });
});

describe('renderMetrics', () => {
  it('writes one table per section with the source note', () => {
    const md = renderMetrics([{ title: 'Laptop over a VPN', note: 'Latency includes the VPN.', metrics: summarize([call('/a', 200, 120), call('/a', 401, 8000, '40103')]) }], '2026-10-06 08:00 UTC');
    expect(md).toContain('## Laptop over a VPN');
    expect(md).toContain('Latency includes the VPN.');
    expect(md).toContain('| `/a` | 2 | 50.0% | 120 | 120 |');
    expect(md).toContain('| 401 | 40103 | 1 | 8,000 |');
  });
});
