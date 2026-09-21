// T1 probe. Saves every response, success or error, to fixtures/web3/.
//
//   pnpm probe discover   platforms, BSC token list, and search for each candidate ticker
//   pnpm probe prices     price, underlying market, market price and a $100 quote for each
//                         token in scripts/probe-targets.json (fill it in from the discover fixtures)

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createWeb3Client, saveFixture, Web3ApiError, type ApiCall, type Web3Response } from '@oneticker/clients';

const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const TARGETS = fileURLToPath(new URL('./probe-targets.json', import.meta.url));
const BSC = '56';
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD, 18 decimals
const CANDIDATE_TICKERS = ['NVDA', 'TSLA', 'QQQ', 'CRCL', 'META', 'MSFT', 'MSTR'];

interface Targets {
  /** Receiver for RFQ quotes (Ondo, bStocks). Use the hot wallet address. */
  wallet?: string;
  tokens: { instrument: string; venue: string; symbol: string; address: string }[];
}

const apiKey = process.env.BINANCE_WEB3_API_KEY;
const apiSecret = process.env.BINANCE_WEB3_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error('Set BINANCE_WEB3_API_KEY and BINANCE_WEB3_API_SECRET in .env (see .env.example).');
  process.exit(1);
}

const calls: ApiCall[] = [];
const client = createWeb3Client({
  apiKey,
  apiSecret,
  ...(process.env.BINANCE_WEB3_BASE_URL ? { baseUrl: process.env.BINANCE_WEB3_BASE_URL } : {}),
  onCall: (c) => {
    calls.push(c);
    console.log(`${c.method} ${c.endpoint} -> ${c.httpStatus} ${c.errorCode ?? 'ok'} ${c.latencyMs}ms ${c.bytes}B`);
  },
});

async function probe(name: string, call: () => Promise<Web3Response<unknown>>): Promise<void> {
  try {
    const res = await call();
    console.log(`  saved ${await saveFixture(FIXTURES, 'web3', name, res.envelope)}`);
  } catch (error) {
    if (!(error instanceof Web3ApiError)) throw error;
    const payload = { httpStatus: error.httpStatus, code: error.code, message: error.message, response: error.raw };
    console.log(`  saved ${await saveFixture(FIXTURES, 'web3', `${name}-error`, payload)}`);
  }
}

async function discover(): Promise<void> {
  await probe('rwa-platforms', () => client.get('/api/v1/dex/market/rwa/platforms'));
  await probe('rwa-tokens-bsc', () => client.get('/api/v1/dex/market/rwa/tokens', { binanceChainId: BSC }));
  for (const ticker of CANDIDATE_TICKERS) {
    await probe(`rwa-search-${ticker}`, () => client.get('/api/v1/dex/market/rwa/search', { keyword: ticker }));
    // xStocks is not an RWA platform in the connector, so look for it through general token search too.
    await probe(`market-token-search-${ticker}`, () => client.get('/api/v1/dex/market/token/search', { chains: BSC, search: ticker }));
  }
}

async function prices(): Promise<void> {
  const targets = JSON.parse(await readFile(TARGETS, 'utf8')) as Targets;
  const addresses = targets.tokens.map((t) => t.address);

  await probe('rwa-price', () => client.get('/api/v1/dex/market/rwa/price', { binanceChainId: BSC, tokenContractAddresses: addresses.join(',') }));
  // Body shape is undocumented in both official connectors; this is a guess, and an error fixture is also an answer.
  await probe('market-price', () => client.post('/api/v1/dex/market/price', addresses.map((a) => ({ binanceChainId: BSC, tokenContractAddress: a }))));

  for (const t of targets.tokens) {
    const token = { binanceChainId: BSC, tokenContractAddress: t.address };
    await probe(`rwa-underlying-market-${t.symbol}`, () => client.get('/api/v1/dex/market/rwa/underlying-market', token));
    await probe(`rwa-underlying-profile-${t.symbol}`, () => client.get('/api/v1/dex/market/rwa/underlying-profile', token));
    await probe(`aggregator-quote-${t.symbol}-100usd`, () =>
      client.get('/api/v1/dex/aggregator/quote', {
        binanceChainId: BSC,
        amount: (100n * 10n ** 18n).toString(),
        fromTokenAddress: USDT_BSC,
        toTokenAddress: t.address,
        userWalletAddress: targets.wallet,
      }),
    );
  }
}

const phase = process.argv[2];
if (phase === 'discover') await discover();
else if (phase === 'prices') await prices();
else {
  console.error('Usage: pnpm probe discover | prices');
  process.exit(1);
}

console.log(`\n${calls.length} calls, ${calls.filter((c) => c.errorCode).length} errors`);
await saveFixture(FIXTURES, 'web3', `_calls-${phase}`, calls);
