import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createWeb3Client, type ApiCall } from './client';
import { Web3ApiError } from './errors';
import { sign } from './sign';

type Reply = { status?: number; body: unknown; headers?: Record<string, string> };

function fakeFetch(...replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const reply = replies.shift();
    if (!reply) throw new Error('no more replies');
    const text = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status: reply.status ?? 200, headers: reply.headers });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

function setup(...replies: Reply[]) {
  const { fetch, calls } = fakeFetch(...replies);
  const apiCalls: ApiCall[] = [];
  const client = createWeb3Client({ apiKey: 'key', apiSecret: 'secret', fetch, onCall: (c) => apiCalls.push(c) });
  return { client, calls, apiCalls };
}

const ok = (data: unknown) => ({ body: { code: '000000', message: 'success', success: true, data } });

describe('createWeb3Client', () => {
  it('signs the /build path with the query exactly as sent', async () => {
    const { client, calls } = setup(ok([{ price: '1' }]));
    await client.get('/api/v1/dex/market/rwa/price', { binanceChainId: '56', tokenContractAddresses: '0xabc,0xdef', skipped: undefined });

    const { url, init } = calls[0]!;
    expect(url).toBe('https://web3.binance.com/build/api/v1/dex/market/rwa/price?binanceChainId=56&tokenContractAddresses=0xabc%2C0xdef');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-OC-APIKEY']).toBe('key');
    expect(headers['X-OC-TIMESTAMP']).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(headers['X-OC-SIGN']).toBe(
      sign({
        secret: 'secret',
        timestamp: headers['X-OC-TIMESTAMP']!,
        method: 'GET',
        requestPath: '/build/api/v1/dex/market/rwa/price?binanceChainId=56&tokenContractAddresses=0xabc%2C0xdef',
        body: '',
      }),
    );
  });

  it('sends and signs the same JSON body on POST', async () => {
    const { client, calls } = setup(ok([]));
    const body = [{ binanceChainId: '56', tokenContractAddress: '0xabc' }];
    await client.post('/api/v1/dex/market/price', body);

    const { init } = calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(init.body).toBe(JSON.stringify(body));
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-OC-SIGN']).toBe(
      sign({ secret: 'secret', timestamp: headers['X-OC-TIMESTAMP']!, method: 'POST', requestPath: '/build/api/v1/dex/market/price', body: JSON.stringify(body) }),
    );
  });

  it('unwraps data and records the call', async () => {
    const { client, apiCalls } = setup(ok({ platforms: ['ondo'] }));
    const res = await client.get<{ platforms: string[] }>('/api/v1/dex/market/rwa/platforms');

    expect(res.data).toEqual({ platforms: ['ondo'] });
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]).toMatchObject({ method: 'GET', endpoint: '/api/v1/dex/market/rwa/platforms', httpStatus: 200, errorCode: null });
    expect(apiCalls[0]!.bytes).toBeGreaterThan(0);
  });

  it('accepts an envelope with code 0 and no success field', async () => {
    const { client } = setup({ body: { code: 0, msg: 'ok', data: 42 } });
    await expect(client.get('/x')).resolves.toMatchObject({ data: 42 });
  });

  it('throws on an API error inside HTTP 200 and keeps the raw envelope', async () => {
    const envelope = { code: 40369, msg: 'bStock RFQ unavailable outside exchange hours', success: false, data: null };
    const { client, apiCalls } = setup({ body: envelope });

    const error = await client.get('/api/v1/dex/aggregator/quote').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Web3ApiError);
    expect(error).toMatchObject({ code: '40369', httpStatus: 200, raw: envelope });
    expect(apiCalls[0]!.errorCode).toBe('40369');
  });

  it('maps the real unsigned-request 401 to code 40101', async () => {
    const fixture = JSON.parse(
      readFileSync(new URL('../../../../fixtures/web3/rwa-platforms-unsigned-20260921T153507Z.json', import.meta.url), 'utf8'),
    ) as { httpStatus: number; response: unknown };
    const { client, apiCalls } = setup({ status: fixture.httpStatus, body: fixture.response });

    await expect(client.get('/api/v1/dex/market/rwa/platforms')).rejects.toMatchObject({
      code: '40101',
      httpStatus: 401,
      message: '/api/v1/dex/market/rwa/platforms: 40101 API Key is required',
    });
    expect(apiCalls[0]).toMatchObject({ httpStatus: 401, errorCode: '40101' });
  });

  it('throws NON_JSON on an HTML error page', async () => {
    const { client, apiCalls } = setup({ status: 403, body: '<html>blocked</html>' });

    await expect(client.get('/x')).rejects.toMatchObject({ code: 'NON_JSON', httpStatus: 403, raw: '<html>blocked</html>' });
    expect(apiCalls[0]).toMatchObject({ httpStatus: 403, errorCode: 'NON_JSON' });
  });

  it('retries a 429 after Retry-After and logs both attempts', async () => {
    vi.useFakeTimers();
    try {
      const { client, calls, apiCalls } = setup(
        { status: 429, body: { code: 429, msg: 'Too many requests', success: false }, headers: { 'Retry-After': '2' } },
        ok('fine'),
      );
      const pending = client.get('/x');
      await vi.advanceTimersByTimeAsync(1999);
      expect(calls).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toMatchObject({ data: 'fine' });
      expect(apiCalls.map((c) => c.httpStatus)).toEqual([429, 200]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports network failures as NETWORK_ERROR with status 0', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof globalThis.fetch;
    const apiCalls: ApiCall[] = [];
    const client = createWeb3Client({ apiKey: 'k', apiSecret: 's', fetch, onCall: (c) => apiCalls.push(c) });

    await expect(client.get('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', httpStatus: 0 });
    expect(apiCalls[0]).toMatchObject({ httpStatus: 0, errorCode: 'NETWORK_ERROR', bytes: 0 });
  });
});
