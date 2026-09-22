// Real I/O for the tools: live Web3 API and BSC reads for quote_route, the Tape's HTTP API for get_price_surfaces.

import { createBscClient, createWeb3Client, gatherRouteInputs, type Web3Client } from '@oneticker/clients';
import { RouteStore, type TapeLatest, type ToolDeps } from './tools';

export const DEFAULT_TAPE_API_URL = 'https://tape-production-c409.up.railway.app';

export function liveDeps(env: NodeJS.ProcessEnv = process.env): ToolDeps {
  const web3: Web3Client | null =
    env.BINANCE_WEB3_API_KEY && env.BINANCE_WEB3_API_SECRET
      ? createWeb3Client({ apiKey: env.BINANCE_WEB3_API_KEY, apiSecret: env.BINANCE_WEB3_API_SECRET, ...(env.BINANCE_WEB3_BASE_URL ? { baseUrl: env.BINANCE_WEB3_BASE_URL } : {}) })
      : null;
  const chain = createBscClient(env.BSC_RPC_URL);
  const tapeUrl = (env.TAPE_API_URL ?? DEFAULT_TAPE_API_URL).replace(/\/$/, '');

  return {
    gather: (req) => gatherRouteInputs({ web3, chain, quoteWallet: env.TAPE_QUOTE_WALLET }, req),
    async tapeLatest() {
      try {
        const res = await fetch(`${tapeUrl}/api/latest`, { signal: AbortSignal.timeout(8_000) });
        return res.ok ? ((await res.json()) as TapeLatest) : null;
      } catch {
        return null;
      }
    },
    now: () => new Date(),
    routes: new RouteStore(),
  };
}
