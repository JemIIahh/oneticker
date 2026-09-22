import { createPublicClient, http, type PublicClient } from 'viem';
import { bsc } from 'viem/chains';

export const DEFAULT_BSC_RPC = 'https://bsc-dataseed.bnbchain.org';

export function createBscClient(rpcUrl: string = DEFAULT_BSC_RPC): PublicClient {
  return createPublicClient({ chain: bsc, transport: http(rpcUrl, { timeout: 15_000 }) });
}
