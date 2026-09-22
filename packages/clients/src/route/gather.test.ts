import { instruments } from '@oneticker/core';
import type { PublicClient } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { Web3ApiError, type Web3Client, type Web3Response } from '../web3';
import { gatherRouteInputs } from './gather';

vi.mock('../chain', () => ({
  APRO_FEEDS_BSC: {},
  readAproFeed: vi.fn(),
  readMultiplier: vi.fn(async () => ({ multiplier: 1.0007782237528078, pending: null })),
}));

const nvda = instruments.find((i) => i.ticker === 'NVDA')!;
const [nvdab, nvdaon, nvdax] = nvda.venues as [(typeof nvda.venues)[0], (typeof nvda.venues)[0], (typeof nvda.venues)[0]];
const ok = <T>(data: T): Web3Response<T> => ({ data, envelope: {}, httpStatus: 200, latencyMs: 1 });
// 500 USDT in (18 decimals) for 2.18 tokens out (18 decimals): 229.36 USD per token.
const quote = [{ vendorName: 'LiquidMesh', fromTokenAmount: '500000000000000000000', toTokenAmount: '2180000000000000000', fromToken: { decimal: '18' }, toToken: { decimal: '18' } }];

function fakeWeb3(opts: { rwaFails?: boolean; quoteCode?: string }): Web3Client {
  return {
    async get<T>(endpoint: string) {
      if (endpoint.endsWith('/rwa/price')) {
        if (opts.rwaFails) throw new Web3ApiError(endpoint, 0, 'TIMEOUT', 'timed out', null);
        return ok([
          { tokenContractAddress: nvdab.address, tokenPrice: '229.5', referencePrice: '229.32', tokenPriceUpdatedAt: 1 },
          { tokenContractAddress: nvdaon.address, tokenPrice: '229.6', referencePrice: '229.2', tokenPriceUpdatedAt: 1 },
        ]) as Web3Response<T>;
      }
      if (opts.quoteCode) throw new Web3ApiError(endpoint, 200, opts.quoteCode, 'nope', null);
      return ok(quote) as Web3Response<T>;
    },
    async post<T>() {
      return ok([{ tokenContractAddress: nvdax.address, price: '229.9', time: 1 }]) as Web3Response<T>;
    },
  };
}

const run = (web3: Web3Client | null) => gatherRouteInputs({ web3, chain: {} as PublicClient }, { instrument: nvda, side: 'buy', amountUsd: 500 });
const byIssuer = async (web3: Web3Client | null) => Object.fromEntries((await run(web3)).venues.map((v) => [v.issuer, v]));

describe('gatherRouteInputs', () => {
  it('takes each venue share ratio from its own source', async () => {
    const v = await byIssuer(fakeWeb3({}));
    expect(v.bstocks?.shareRatio).toBe(1.0007782237528078);
    expect(v.ondo?.shareRatio).toBeCloseTo(229.6 / 229.2);
    expect(v.xstocks?.shareRatio).toBe(1);
    expect(v.ondo?.execPxAtAmount).toBeCloseTo(500 / 2.18);
    expect(v.ondo?.quoteVendor).toBe('LiquidMesh');
  });

  it('excludes a quoted Ondo venue whose share ratio is unknown instead of assuming 1', async () => {
    const v = await byIssuer(fakeWeb3({ rwaFails: true }));
    expect(v.ondo).toMatchObject({ execPxAtAmount: null, quoteError: 'NO_SHARE_RATIO' });
    expect(v.xstocks?.execPxAtAmount).not.toBeNull();
  });

  it('keeps the API error when the quote itself failed', async () => {
    const v = await byIssuer(fakeWeb3({ rwaFails: true, quoteCode: '40304' }));
    expect(v.ondo?.quoteError).toBe('40304');
    expect(v.bstocks?.quoteError).toBe('40304');
  });

  it('marks every venue NO_API_KEYS without a client', async () => {
    const r = await run(null);
    expect(r.venues.map((v) => v.quoteError)).toEqual(['NO_API_KEYS', 'NO_API_KEYS', 'NO_API_KEYS']);
    expect(r.referenceSource).toBeNull();
  });
});
