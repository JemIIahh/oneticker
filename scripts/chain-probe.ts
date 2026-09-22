// Reads every APRO feed and every bStocks multiplier in the registry from BSC and saves fixtures/chain/.
//
//   pnpm chain-probe

import { fileURLToPath } from 'node:url';
import { APRO_FEEDS_BSC, createBscClient, readAproFeed, readMultiplier, saveFixture } from '@oneticker/clients';
import { instruments } from '@oneticker/core';

const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const client = createBscClient(process.env.BSC_RPC_URL);
const now = new Date();

for (const instrument of instruments) {
  const bstock = instrument.venues.find((v) => v.issuer === 'bstocks');
  if (!bstock) continue;

  try {
    const m = await readMultiplier(client, bstock.address, now);
    console.log(`${bstock.symbol.padEnd(6)} uiMultiplier ${m.multiplier} pending ${m.pending ? `${m.pending.multiplier} at ${m.pending.effectiveAt.toISOString()}` : 'none'}`);
    await saveFixture(FIXTURES, 'chain', `bep677-${bstock.symbol}`, { at: now.toISOString(), ...m }, now);
  } catch (error) {
    console.log(`${bstock.symbol.padEnd(6)} uiMultiplier ERROR ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    await saveFixture(FIXTURES, 'chain', `bep677-${bstock.symbol}-error`, { at: now.toISOString(), error: String(error) }, now);
  }

  const feed = APRO_FEEDS_BSC[bstock.symbol];
  if (!feed) {
    console.log(`${bstock.symbol.padEnd(6)} APRO feed: none listed`);
    continue;
  }
  try {
    const o = await readAproFeed(client, feed, now);
    console.log(`${bstock.symbol.padEnd(6)} APRO "${o.description}" ${o.price} (${o.decimals} dp) updated ${o.updatedAt.toISOString()} age ${o.ageSec}s`);
    await saveFixture(FIXTURES, 'chain', `apro-${bstock.symbol}`, { at: now.toISOString(), ...o }, now);
  } catch (error) {
    console.log(`${bstock.symbol.padEnd(6)} APRO ERROR ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    await saveFixture(FIXTURES, 'chain', `apro-${bstock.symbol}-error`, { at: now.toISOString(), error: String(error) }, now);
  }
}
