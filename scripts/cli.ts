// oneticker CLI (T5). Ranks every venue for one instrument by share-equivalent price, with a gate verdict
// per venue and a plain-English reason for any venue an API error ruled out (SPEC 3.6).
//
//   pnpm oneticker quote NVDA buy 500

import { createBscClient, createWeb3Client, gatherRouteInputs, type Web3Client } from '@oneticker/clients';
import { formatDuration, instruments, quoteRoute } from '@oneticker/core';

function usage(): never {
  console.error('Usage: pnpm oneticker quote <TICKER> <buy|sell> <amountUsd>');
  console.error(`Known tickers: ${instruments.map((i) => i.ticker).join(', ')}`);
  process.exit(1);
}

const [cmd, tickerArg, sideArg, amountArg] = process.argv.slice(2);
if (cmd !== 'quote' || !tickerArg || !sideArg || !amountArg) usage();
const sideRaw = sideArg.toLowerCase();
if (sideRaw !== 'buy' && sideRaw !== 'sell') usage();
// Explicit annotation: narrowing from the check above does not carry into main().
const side: 'buy' | 'sell' = sideRaw;
const amountUsd = Number(amountArg);
if (!Number.isFinite(amountUsd) || amountUsd <= 0) usage();

const instrument = instruments.find((i) => i.ticker === tickerArg.toUpperCase());
if (!instrument) usage();

const apiKey = process.env.BINANCE_WEB3_API_KEY;
const apiSecret = process.env.BINANCE_WEB3_API_SECRET;
const web3: Web3Client | null =
  apiKey && apiSecret ? createWeb3Client({ apiKey, apiSecret, ...(process.env.BINANCE_WEB3_BASE_URL ? { baseUrl: process.env.BINANCE_WEB3_BASE_URL } : {}) }) : null;
const chain = createBscClient(process.env.BSC_RPC_URL);

if (!web3) console.error('note: BINANCE_WEB3_API_KEY / BINANCE_WEB3_API_SECRET not set — every venue will show excluded (NO_API_KEYS)\n');

async function main(): Promise<void> {
  const { venues, referenceSep } = await gatherRouteInputs(
    { web3, chain, quoteWallet: process.env.TAPE_QUOTE_WALLET },
    { instrument: instrument!, side, amountUsd },
  );
  const result = quoteRoute({ ticker: instrument!.ticker, side, amountUsd, referenceSep, venues, now: new Date() });

  console.log(`${result.ticker}  ${result.side} $${result.amountUsd}`);
  console.log(`market: ${result.clock.state}${result.clock.state !== 'REGULAR' ? ` (reference ${formatDuration(result.clock.referenceAgeSec)} old)` : ''}`);
  console.log(`reference: ${result.referenceSep !== null ? `$${result.referenceSep.toFixed(4)} per share (Binance's derived price — not an independent quote)` : 'none available'}`);
  console.log('');

  if (result.routes.length === 0) console.log('No venue can quote right now.');
  result.routes.forEach((route, i) => {
    const premium = route.premiumBps !== null ? `${route.premiumBps >= 0 ? '+' : ''}${Math.round(route.premiumBps)} bps` : '—';
    console.log(`${i + 1}. ${route.symbol.padEnd(8)} ${route.issuer.padEnd(8)} $${route.sep.toFixed(4)}/share  ${premium.padStart(9)}  ${route.gate.verdict}${route.vendor ? `  via ${route.vendor}` : ''}`);
    for (const reason of route.gate.reasons) console.log(`     ${reason.detail}`);
  });

  if (result.excluded.length > 0) {
    console.log('\nExcluded:');
    for (const e of result.excluded) console.log(`  ${e.symbol.padEnd(8)} ${e.issuer.padEnd(8)} ${e.reason} (${e.code})`);
  }
}

await main();
