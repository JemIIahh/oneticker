import { describe, expect, it } from 'vitest';
import { Web3ApiError, type Query, type Web3Client, type Web3Response } from '@oneticker/clients';
import type { Instrument } from '@oneticker/core';
import type { PublicClient } from 'viem';
import { createCollector } from './collect';

const NVDA: Instrument = {
  id: 'US:NVDA',
  ticker: 'NVDA',
  name: 'NVIDIA',
  venues: [
    { issuer: 'bstocks', symbol: 'NVDAB', address: '0x00000000000000000000000000000000000000b1', decimals: 18, path: 'RFQ_BSTOCK' },
    { issuer: 'xstocks', symbol: 'NVDAx', address: '0x00000000000000000000000000000000000000c1', decimals: 18, path: 'AMM' },
  ],
};

function fakeWeb3(fail: (endpoint: string, query: Query) => boolean = () => false) {
  const calls: { endpoint: string; query: Query }[] = [];
  const web3: Web3Client = {
    async get<T>(endpoint: string, query: Query = {}): Promise<Web3Response<T>> {
      calls.push({ endpoint, query });
      if (fail(endpoint, query)) {
        throw new Web3ApiError(endpoint, 200, '40369', 'bStock RFQ unavailable outside exchange hours', { code: 40369 });
      }
      return { data: null as T, envelope: { code: 0, data: null as T }, httpStatus: 200, latencyMs: 1 };
    },
    async post<T>(endpoint: string): Promise<Web3Response<T>> {
      calls.push({ endpoint, query: {} });
      return { data: null as T, envelope: { code: 0, data: null as T }, httpStatus: 200, latencyMs: 1 };
    },
  };
  return { web3, calls };
}

describe('createCollector', () => {
  it('batches rwa/price, skips RWA endpoints for xStocks, and quotes three notionals per venue', async () => {
    const { web3, calls } = fakeWeb3();
    const results = await createCollector({ web3, chain: null, quoteWallet: '0xwallet' })([NVDA]);

    expect(calls.map((c) => c.endpoint)).toEqual([
      '/api/v1/dex/market/rwa/price',
      '/api/v1/dex/market/price',
      '/api/v1/dex/market/rwa/underlying-market',
      '/api/v1/dex/aggregator/quote',
      '/api/v1/dex/aggregator/quote',
      '/api/v1/dex/aggregator/quote',
      '/api/v1/dex/aggregator/quote',
      '/api/v1/dex/aggregator/quote',
      '/api/v1/dex/aggregator/quote',
    ]);
    expect(calls[0]!.query).toEqual({ binanceChainId: '56', tokenContractAddresses: '0x00000000000000000000000000000000000000b1' });
    expect(calls[3]!.query).toMatchObject({ amount: '100000000000000000000', toTokenAddress: '0x00000000000000000000000000000000000000b1', userWalletAddress: '0xwallet' });
    expect(calls[5]!.query.amount).toBe('10000000000000000000000');

    const xstocks = results.find((r) => r.venue.issuer === 'xstocks')!;
    expect(xstocks.raw.rwaPrice).toBeNull();
    expect(xstocks.raw.underlyingMarket).toBeNull();
    expect(Object.keys(xstocks.raw.quotes)).toEqual(['100', '1000', '10000']);
  });

  it('keeps API errors as data instead of failing the run', async () => {
    const { web3 } = fakeWeb3((endpoint, query) => endpoint.endsWith('/quote') && query.toTokenAddress === NVDA.venues[0]!.address);
    const results = await createCollector({ web3, chain: null })([NVDA]);

    const bstocks = results.find((r) => r.venue.issuer === 'bstocks')!;
    expect(bstocks.raw.quotes['100']).toMatchObject({ ok: false, code: '40369', httpStatus: 200, response: { code: 40369 } });
    expect(results.find((r) => r.venue.issuer === 'xstocks')!.raw.quotes['100']).toMatchObject({ ok: true });
  });

  it('records NO_API_KEYS for Web3 surfaces but still reads the chain when keys are missing', async () => {
    const chain = {
      readContract: async ({ functionName }: { functionName: string }) =>
        ({
          decimals: 8,
          description: 'NVDAB/USD',
          latestRoundData: [1n, 22692509000n, 1790072755n, 1790072755n, 1n],
          uiMultiplier: 1000778223752807865n,
          newUIMultiplier: 1000778223752807865n,
          effectiveAt: 0n,
        })[functionName],
    } as unknown as PublicClient;
    const results = await createCollector({ web3: null, chain, now: () => new Date('2026-09-22T10:58:15.673Z') })([NVDA]);

    const bstocks = results.find((r) => r.venue.issuer === 'bstocks')!;
    expect(bstocks.raw.rwaPrice).toMatchObject({ ok: false, code: 'NO_API_KEYS' });
    expect(bstocks.raw.quotes['100']).toMatchObject({ ok: false, code: 'NO_API_KEYS' });
    expect(bstocks.oracle).toMatchObject({ price: 226.92509, ageSec: 1940 });
    expect(bstocks.multiplier).toMatchObject({ multiplier: 1.0007782237528078 });

    const xstocks = results.find((r) => r.venue.issuer === 'xstocks')!;
    expect(xstocks.oracle).toBeNull();
    expect(xstocks.multiplier).toBeNull();
  });

  it('keeps a failed chain read as data', async () => {
    const chain = {
      readContract: async () => {
        throw new Error('HTTP request failed');
      },
    } as unknown as PublicClient;
    const results = await createCollector({ web3: null, chain })([NVDA]);
    const bstocks = results.find((r) => r.venue.issuer === 'bstocks')!;
    expect(bstocks.oracle).toBeNull();
    expect(bstocks.raw.oracle).toMatchObject({ error: expect.stringContaining('HTTP request failed') });
    expect(bstocks.raw.multiplier).toMatchObject({ error: expect.stringContaining('HTTP request failed') });
  });
});
