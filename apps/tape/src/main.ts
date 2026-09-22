// Off-Hours Tape.
//
//   pnpm --filter tape once          one run
//   pnpm --filter tape start         a run now, then one every TAPE_INTERVAL_SEC on the wall-clock slot;
//                                    checks the previous UTC day for gaps once per day
//   pnpm --filter tape check [day]   row-count check for one UTC day (default: yesterday); exit 1 on gaps

import { createBscClient, createWeb3Client } from '@oneticker/clients';
import { instruments, marketClock } from '@oneticker/core';
import { checkDay } from './check';
import { createCollector, type Collect } from './collect';
import { loadConfig } from './config';
import { openTape } from './db';
import { runOnce } from './run';
import { msUntilNextSlot, previousUtcDay } from './schedule';

const config = loadConfig();
const db = openTape(config.dbPath);

const web3 =
  config.apiKey && config.apiSecret
    ? createWeb3Client({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        onCall: (call) => db.insertApiCall(call),
      })
    : null;
if (!web3) console.log('TAPE_WARN BINANCE_WEB3_API_KEY and BINANCE_WEB3_API_SECRET are not set; Web3 surfaces will be recorded as NO_API_KEYS');

const collect: Collect = createCollector({
  web3,
  chain: createBscClient(config.bscRpcUrl),
  ...(config.quoteWallet ? { quoteWallet: config.quoteWallet } : {}),
});

const tick = () => runOnce({ db, instruments, collect, marketState: (at) => marketClock(at).state });

function logCheck(day: string): boolean {
  const result = checkDay(db, day, config.intervalSec);
  console.log(`${result.flags.length > 0 ? 'CHECK_GAPS' : 'CHECK'} ${JSON.stringify(result)}`);
  return result.flags.length === 0;
}

async function start(): Promise<void> {
  console.log(`TAPE_START ${JSON.stringify({ dbPath: config.dbPath, intervalSec: config.intervalSec, instruments: instruments.length })}`);
  let checkedDay = previousUtcDay(new Date());
  await tick();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, msUntilNextSlot(Date.now(), config.intervalSec)));
    await tick();
    const yesterday = previousUtcDay(new Date());
    if (yesterday !== checkedDay) {
      logCheck(yesterday);
      checkedDay = yesterday;
    }
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`TAPE_STOP ${signal}`);
    db.close();
    process.exit(0);
  });
}

const [command, arg] = process.argv.slice(2);
if (command === 'once') {
  const summary = await tick();
  process.exitCode = summary.ok ? 0 : 1;
} else if (command === 'start') {
  await start();
} else if (command === 'check') {
  process.exitCode = logCheck(arg ?? previousUtcDay(new Date())) ? 0 : 1;
} else {
  console.error('Usage: tape once | start | check [YYYY-MM-DD]');
  process.exitCode = 1;
}
if (command !== 'start') db.close();
