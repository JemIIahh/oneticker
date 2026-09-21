// Can this host reach the Web3 API? Sends one unsigned request (no keys needed) and prints
// status, latency, headers and body on one line prefixed REACH. Expect an auth error envelope.
//
//   pnpm reach

const url = 'https://web3.binance.com/build/api/v1/dex/market/rwa/platforms';
const started = Date.now();
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  console.log(`REACH ${JSON.stringify({ url, status: res.status, ms: Date.now() - started, headers: Object.fromEntries(res.headers), body })}`);
} catch (error) {
  const cause = error instanceof Error && error.cause !== undefined ? String(error.cause) : undefined;
  console.log(`REACH ${JSON.stringify({ url, error: String(error), cause, ms: Date.now() - started })}`);
}
