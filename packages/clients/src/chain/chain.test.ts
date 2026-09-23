import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { readAproFeed } from './apro';
import { readMultiplier } from './bep677';

// Raw values from live BSC reads on 22 Sep 2026 (fixtures/chain/*-20260922T105815Z.json).
const apro = JSON.parse(readFileSync(new URL('../../../../fixtures/chain/apro-NVDAB-20260922T105815Z.json', import.meta.url), 'utf8')) as {
  feed: `0x${string}`;
  raw: { roundId: string; answer: string; startedAt: string; updatedAt: string; answeredInRound: string };
};
const bep = JSON.parse(readFileSync(new URL('../../../../fixtures/chain/bep677-NVDAB-20260922T105815Z.json', import.meta.url), 'utf8')) as {
  token: `0x${string}`;
  raw: { uiMultiplier: string; newUIMultiplier: string; effectiveAt: string };
};

/** A PublicClient that answers readContract from a table keyed by function name. */
function fakeClient(answers: Record<string, unknown>): PublicClient {
  return {
    readContract: async ({ functionName }: { functionName: string }) => {
      if (!(functionName in answers)) throw new Error(`execution reverted: ${functionName}`);
      const value = answers[functionName];
      return typeof value === 'function' ? value() : value;
    },
  } as unknown as PublicClient;
}

const now = new Date('2026-09-22T10:58:15.673Z');

describe('readAproFeed', () => {
  it('decodes the real NVDAB/USD round into a price and age', async () => {
    const r = apro.raw;
    const client = fakeClient({
      decimals: 8,
      description: 'NVDAB/USD',
      latestRoundData: [BigInt(r.roundId), BigInt(r.answer), BigInt(r.startedAt), BigInt(r.updatedAt), BigInt(r.answeredInRound)],
    });
    await expect(readAproFeed(client, apro.feed, now)).resolves.toMatchObject({
      description: 'NVDAB/USD',
      decimals: 8,
      price: 226.92509,
      updatedAt: new Date('2026-09-22T10:25:55.000Z'),
      ageSec: 1940,
      raw: { answer: '22692509000' },
    });
  });
});

describe('readMultiplier', () => {
  it('decodes the real NVDAB uiMultiplier with no pending change', async () => {
    const client = fakeClient({
      uiMultiplier: BigInt(bep.raw.uiMultiplier),
      newUIMultiplier: BigInt(bep.raw.newUIMultiplier),
      effectiveAt: BigInt(bep.raw.effectiveAt),
    });
    await expect(readMultiplier(client, bep.token, now)).resolves.toMatchObject({
      multiplier: 1.0007782237528078,
      pending: null,
      raw: { uiMultiplier: '1000778223752807865', effectiveAt: '0' },
    });
  });

  it('reports a scheduled multiplier change', async () => {
    const effective = new Date('2026-09-25T20:00:00.000Z');
    const client = fakeClient({
      uiMultiplier: 10n ** 18n,
      newUIMultiplier: 2n * 10n ** 18n, // a 2-for-1 split
      effectiveAt: BigInt(Math.floor(effective.getTime() / 1000)),
    });
    await expect(readMultiplier(client, bep.token, now)).resolves.toMatchObject({ multiplier: 1, pending: { multiplier: 2, effectiveAt: effective } });
  });

  it('tolerates a token without the pending extension', async () => {
    const client = fakeClient({ uiMultiplier: 10n ** 18n });
    await expect(readMultiplier(client, bep.token, now)).resolves.toMatchObject({ multiplier: 1, pending: null, raw: { newUIMultiplier: null, effectiveAt: null } });
  });
});

describe('priceFromSqrtX96', () => {
  it('recovers the price from a PancakeSwap v3 sqrtPriceX96', async () => {
    const { priceFromSqrtX96 } = await import('./pancake');
    // 228.456 USDT per token, both 18 decimals: sqrt(228.456) * 2^96
    const sqrt = BigInt(Math.round(Math.sqrt(228.456) * 2 ** 96));
    expect(priceFromSqrtX96(sqrt, 18, 18)).toBeCloseTo(228.456, 6);
    // Decimal adjustment: token0 with 6 decimals, token1 with 18.
    expect(priceFromSqrtX96(sqrt, 6, 18)).toBeCloseTo(228.456e-12, 15);
  });
});
