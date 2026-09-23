import { parseAbi, type PublicClient } from 'viem';

/**
 * The deepest PancakeSwap v3 USDT pool per bStock, found by reading the v3 factory for every fee tier on
 * 22 Sep 2026 (fixtures/chain/pancake-pools-20260922T231305Z.json). Ondo and xStocks have no pool worth reading
 * (under $3k); every bStock does ($113k to $1.8M on the stock side). Read straight from BSC, so this price
 * survives a Binance API outage or a region block.
 */
export const PANCAKE_POOLS_BSC: Record<string, { pool: `0x${string}`; fee: number }> = {
  NVDAB: { pool: '0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C', fee: 2500 },
  TSLAB: { pool: '0xB0f5E5400E8F0F7C242F2b7740C004f020579c41', fee: 2500 },
  QQQB: { pool: '0xe531fcb1F5a195de7608B9F4f9518544C2cdB693', fee: 100 },
  CRCLB: { pool: '0x29967c54c5Bf12E8158c8894376064b30ebaB297', fee: 2500 },
  MSTRB: { pool: '0x692081209619735f25700557078aB084d3E5D007', fee: 2500 },
};

export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD, 18 decimals

const poolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function liquidity() view returns (uint128)',
]);
const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']);

export interface PoolReading {
  pool: `0x${string}`;
  fee: number;
  /** USDT per raw token at the pool's current tick (mid price, before fees and impact). */
  pxPerToken: number;
  tokenBalance: number;
  usdtBalance: number;
  /** The thinner side of the pool in USD: a rough depth figure, not a quote. */
  depthUsd: number;
  tick: number;
  raw: { sqrtPriceX96: string; tick: number; liquidity: string; token0: string; tokenBalance: string; usdtBalance: string };
}

/** Price of token1 in token0 units from sqrtPriceX96, adjusted for decimals. */
export function priceFromSqrtX96(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  return ratio * ratio * 10 ** (decimals0 - decimals1);
}

/** Reads one USDT pool. `token` is the stock token; both it and USDT are 18 decimals on BSC, but read, not assumed. */
export async function readPool(client: PublicClient, pool: `0x${string}`, fee: number, token: `0x${string}`): Promise<PoolReading> {
  const [slot0, token0, liquidity, tokenRaw, usdtRaw, tokenDecimals, usdtDecimals] = await Promise.all([
    client.readContract({ address: pool, abi: poolAbi, functionName: 'slot0' }),
    client.readContract({ address: pool, abi: poolAbi, functionName: 'token0' }),
    client.readContract({ address: pool, abi: poolAbi, functionName: 'liquidity' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [pool] }),
    client.readContract({ address: USDT_BSC, abi: erc20Abi, functionName: 'balanceOf', args: [pool] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: USDT_BSC, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  const [sqrtPriceX96, tick] = slot0;
  const tokenIs0 = token0.toLowerCase() === token.toLowerCase();
  // token1 per token0; flip when the stock token is token1.
  const p = tokenIs0 ? priceFromSqrtX96(sqrtPriceX96, tokenDecimals, usdtDecimals) : 1 / priceFromSqrtX96(sqrtPriceX96, usdtDecimals, tokenDecimals);
  const tokenBalance = Number(tokenRaw) / 10 ** tokenDecimals;
  const usdtBalance = Number(usdtRaw) / 10 ** usdtDecimals;
  return {
    pool,
    fee,
    pxPerToken: p,
    tokenBalance,
    usdtBalance,
    depthUsd: Math.min(tokenBalance * p, usdtBalance),
    tick,
    raw: { sqrtPriceX96: sqrtPriceX96.toString(), tick, liquidity: liquidity.toString(), token0, tokenBalance: tokenRaw.toString(), usdtBalance: usdtRaw.toString() },
  };
}
