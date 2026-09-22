// Builds packages/core/src/registry/instruments.json from the latest bapi token-list fixtures and checks every
// address on-chain (symbol() and decimals() must match the list). Exits 1 and writes nothing on any mismatch.
//
//   pnpm registry

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ExecutionPath, Instrument, Issuer, Venue } from '@oneticker/core';

const FIXTURES = fileURLToPath(new URL('../fixtures/bapi/', import.meta.url));
const OUT = fileURLToPath(new URL('../packages/core/src/registry/instruments.json', import.meta.url));
const RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.bnbchain.org';

// Scope is capped at 5 instruments (CLAUDE.md). MSTR chosen as the fifth on 22 Sep.
const INSTRUMENTS: { ticker: string; name: string }[] = [
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust' },
  { ticker: 'CRCL', name: 'Circle Internet Group' },
  { ticker: 'MSTR', name: 'Strategy' },
];

const ISSUERS: { type: number; issuer: Issuer; path: ExecutionPath }[] = [
  { type: 3, issuer: 'bstocks', path: 'RFQ_BSTOCK' },
  { type: 1, issuer: 'ondo', path: 'RFQ_ONDO' },
  { type: 2, issuer: 'xstocks', path: 'AMM' },
];

interface BapiToken {
  chainId: string;
  contractAddress: string;
  symbol: string;
  ticker: string;
  type: number;
  d: number;
}

function latestList(type: number): BapiToken[] {
  const file = readdirSync(FIXTURES)
    .filter((f) => f.startsWith(`rwa-stock-list-type${type}-`))
    .sort()
    .at(-1);
  if (!file) throw new Error(`no fixture for type=${type} in fixtures/bapi/`);
  return (JSON.parse(readFileSync(FIXTURES + file, 'utf8')) as { data: BapiToken[] }).data;
}

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  });
  const body = (await res.json()) as { result?: string; error?: unknown };
  if (!body.result) throw new Error(`eth_call ${to} ${data}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function onchain(address: string): Promise<{ symbol: string; decimals: number }> {
  const symbolHex = (await ethCall(address, '0x95d89b41')).slice(2);
  const length = parseInt(symbolHex.slice(64, 128), 16);
  const symbol = Buffer.from(symbolHex.slice(128, 128 + length * 2), 'hex').toString('utf8');
  const decimals = parseInt((await ethCall(address, '0x313ce567')).slice(2), 16);
  return { symbol, decimals };
}

const lists = new Map(ISSUERS.map(({ type }) => [type, latestList(type).filter((t) => t.chainId === '56')]));
const problems: string[] = [];
const instruments: Instrument[] = [];

for (const { ticker, name } of INSTRUMENTS) {
  const venues: Venue[] = [];
  for (const { type, issuer, path } of ISSUERS) {
    const token = lists.get(type)!.find((t) => t.ticker === ticker);
    if (!token) {
      console.log(`${ticker.padEnd(5)} ${issuer.padEnd(8)} not listed on BSC`);
      continue;
    }
    const chain = await onchain(token.contractAddress);
    const ok = chain.symbol === token.symbol && chain.decimals === token.d;
    console.log(`${ticker.padEnd(5)} ${issuer.padEnd(8)} ${token.symbol.padEnd(8)} ${token.contractAddress} on-chain ${chain.symbol}/${chain.decimals} ${ok ? 'ok' : 'MISMATCH'}`);
    if (!ok) problems.push(`${ticker} ${issuer}: list ${token.symbol}/${token.d}, chain ${chain.symbol}/${chain.decimals}`);
    venues.push({ issuer, symbol: token.symbol, address: token.contractAddress as `0x${string}`, decimals: token.d, path });
  }
  instruments.push({ id: `US:${ticker}`, ticker, name, venues });
}

if (problems.length > 0) {
  console.error(`\nNot written. ${problems.length} mismatches:\n${problems.join('\n')}`);
  process.exit(1);
}
writeFileSync(OUT, `${JSON.stringify(instruments, null, 2)}\n`);
console.log(`\nWrote ${instruments.length} instruments, ${instruments.reduce((n, i) => n + i.venues.length, 0)} venues to packages/core/src/registry/instruments.json`);
