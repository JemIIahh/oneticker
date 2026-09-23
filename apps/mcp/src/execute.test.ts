import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ExecutionError, type AdapterQuote, type ExecutionAdapter, type SwapRequest } from '@oneticker/clients';
import type { RouteVenueInput } from '@oneticker/core';
import { describe, expect, it } from 'vitest';
import { executeRouteTool, type ExecDeps } from './execute';
import { createServer } from './server';
import { RouteStore, ToolError } from './tools';

// Wed 23 Sep 2026, 15:00 UTC: regular session, so a clean quote is GO.
const OPEN = new Date('2026-09-23T15:00:00Z');
const NVDAB = '0x02fca66c1d1afb4e2a7884261eb00f63598a7436';
const USDT = '0x55d398326f99059fF775485246999027B3197955';

function venue(overrides: Partial<RouteVenueInput> = {}): RouteVenueInput {
  return {
    issuer: 'bstocks',
    symbol: 'NVDAB',
    address: NVDAB,
    shareRatio: 1.0007782237528078,
    onchainPx: 229,
    onchainAt: OPEN,
    execPxAtAmount: 229.2,
    execPxAt100: 229.2,
    quoteVendor: 'PcsXRfq',
    quoteError: null,
    oraclePxAtToken: null,
    oracleAt: null,
    multiplierPending: false,
    halted: false,
    ...overrides,
  };
}

class FakeWallet implements ExecutionAdapter {
  readonly name = 'agentic-wallet' as const;
  swaps: SwapRequest[] = [];
  quotes: SwapRequest[] = [];
  statuses = ['PENDING', 'FINISHED'] as const;
  private polled = 0;
  constructor(private readonly pxPerToken = 229.2) {}
  async quote(req: SwapRequest): Promise<AdapterQuote> {
    this.quotes.push(req);
    const qty = Number(req.fromTokenQty);
    return req.fromToken === USDT
      ? { fromSymbol: 'USDT', fromAmount: qty, toSymbol: 'NVDAB', toAmount: qty / this.pxPerToken, slippage: 0.01, raw: {} }
      : { fromSymbol: 'NVDAB', fromAmount: qty, toSymbol: 'USDT', toAmount: qty * this.pxPerToken, slippage: 0.01, raw: {} };
  }
  async swap(req: SwapRequest) {
    this.swaps.push(req);
    return { orderId: '777', raw: {} };
  }
  async status(orderId: string) {
    const status = this.statuses[Math.min(this.polled++, this.statuses.length - 1)]!;
    return { orderId, status, txHash: status === 'FINISHED' ? '0xfeed' : null, raw: {} };
  }
}

function setup(opts: { mode?: ExecDeps['mode']; wallet?: FakeWallet; venues?: RouteVenueInput[]; amountUsd?: number; side?: 'buy' | 'sell'; referenceSep?: number | null; quotedAt?: Date } = {}) {
  const routes = new RouteStore();
  let now = OPEN;
  const routeId = routes.put({
    ticker: 'NVDA',
    side: opts.side ?? 'buy',
    amountUsd: opts.amountUsd ?? 20,
    referenceSep: opts.referenceSep === undefined ? 229 : opts.referenceSep,
    venues: opts.venues ?? [venue()],
    now: opts.quotedAt ?? OPEN,
  });
  const wallet = opts.wallet ?? new FakeWallet();
  const deps: ExecDeps = { routes, adapter: wallet, mode: opts.mode ?? 'agentic-wallet', maxUsdPerTrade: 25, now: () => now, sleep: async () => {}, previews: new Map() };
  return { deps, routeId, wallet, advance: (sec: number) => (now = new Date(now.getTime() + sec * 1000)) };
}

describe('execute_route', () => {
  it('previews without swapping, then executes on confirm and polls to FINISHED', async () => {
    const { deps, routeId, wallet } = setup();
    const preview = await executeRouteTool(deps, { routeId });
    expect(preview).toMatchObject({ stage: 'preview', executed: false, route: { symbol: 'NVDAB', verdict: 'GO' }, swap: { fromToken: USDT, toToken: NVDAB, fromTokenQty: '20' } });
    expect(wallet.swaps).toHaveLength(0);

    const done = await executeRouteTool(deps, { routeId, confirm: true });
    expect(done).toMatchObject({ stage: 'submitted', executed: true, orderId: '777', status: 'FINISHED', txHash: '0xfeed', explorer: 'https://bscscan.com/tx/0xfeed' });
    expect(wallet.swaps).toEqual([{ fromToken: USDT, toToken: NVDAB, fromTokenQty: '20' }]);
  });

  it('refuses confirm without a preview, and allows one execution per preview', async () => {
    const { deps, routeId, wallet } = setup();
    await expect(executeRouteTool(deps, { routeId, confirm: true })).rejects.toThrow(/No preview/);
    await executeRouteTool(deps, { routeId });
    await executeRouteTool(deps, { routeId, confirm: true });
    await expect(executeRouteTool(deps, { routeId, confirm: true })).rejects.toThrow(/No preview/);
    expect(wallet.swaps).toHaveLength(1);
  });

  it('sends nothing in preview mode, even when confirmed', async () => {
    const { deps, routeId, wallet } = setup({ mode: 'preview' });
    await executeRouteTool(deps, { routeId });
    expect(await executeRouteTool(deps, { routeId, confirm: true })).toMatchObject({ stage: 'not-sent', executed: false });
    expect(wallet.swaps).toHaveLength(0);
  });

  it('enforces the per-trade cap', async () => {
    const { deps, routeId, wallet } = setup({ amountUsd: 26 });
    await expect(executeRouteTool(deps, { routeId })).rejects.toThrow(/over the \$25 per-trade limit/);
    expect(wallet.quotes).toHaveLength(0);
  });

  it('refuses a quote older than 60s; a confirm 30s after the preview still works', async () => {
    const stale = setup({ quotedAt: new Date(OPEN.getTime() - 61_000) });
    await expect(executeRouteTool(stale.deps, { routeId: stale.routeId })).rejects.toThrow(/old \(limit 60s\)/);

    const { deps, routeId, advance } = setup();
    await executeRouteTool(deps, { routeId });
    advance(30);
    await expect(executeRouteTool(deps, { routeId, confirm: true })).resolves.toMatchObject({ executed: true });
  });

  it('never executes BLOCK', async () => {
    const { deps, routeId, wallet } = setup({ venues: [venue({ halted: true })] });
    await expect(executeRouteTool(deps, { routeId, acknowledgeCaution: true })).rejects.toThrow(/BLOCK/);
    expect(wallet.quotes).toHaveLength(0);
  });

  it('requires acknowledgeCaution for CAUTION', async () => {
    const { deps, routeId } = setup({ referenceSep: null }); // REF_MISSING
    await expect(executeRouteTool(deps, { routeId })).rejects.toThrow(/CAUTION.*REF_MISSING/);
    await expect(executeRouteTool(deps, { routeId, acknowledgeCaution: true })).resolves.toMatchObject({ stage: 'preview' });
  });

  it("refuses when the wallet's quote is more than 50 bps worse than the routed price", async () => {
    const { deps, routeId, wallet } = setup({ wallet: new FakeWallet(229.2 * 1.006) });
    await expect(executeRouteTool(deps, { routeId })).rejects.toThrow(/60 bps worse/);
    expect(wallet.swaps).toHaveLength(0);
  });

  it('sizes a sell in tokens from the routed price', async () => {
    const { deps, routeId } = setup({ side: 'sell' });
    const preview = await executeRouteTool(deps, { routeId });
    expect(preview.swap).toMatchObject({ fromToken: NVDAB, toToken: USDT, fromTokenQty: (20 / 229.2).toFixed(8).replace(/0+$/, '') });
  });

  it('uses a named route instead of the best one, and rejects an excluded one', async () => {
    const venues = [venue(), venue({ issuer: 'xstocks', symbol: 'NVDAx', execPxAtAmount: null, execPxAt100: null, quoteError: '40374' })];
    const { deps, routeId } = setup({ venues });
    await expect(executeRouteTool(deps, { routeId, symbol: 'nvdab' })).resolves.toMatchObject({ route: { symbol: 'NVDAB' } });
    await expect(executeRouteTool(deps, { routeId, symbol: 'NVDAx' })).rejects.toThrow(/not an executable route.*40374/);
  });

  it('reports a wallet refusal verbatim and does not claim a fill', async () => {
    const wallet = new FakeWallet();
    wallet.swap = async () => {
      throw new ExecutionError('baw market-order swap', '100', 'SERVICE_ERROR', 'No liquidity available, please try again later.', {});
    };
    const { deps, routeId } = setup({ wallet });
    await executeRouteTool(deps, { routeId });
    await expect(executeRouteTool(deps, { routeId, confirm: true })).rejects.toThrow(ToolError);
    await expect(executeRouteTool(deps, { routeId })).resolves.toBeTruthy();
  });

  it('does not claim success while the order is still pending', async () => {
    const wallet = new FakeWallet();
    wallet.statuses = ['PENDING'] as never;
    const { deps, routeId } = setup({ wallet });
    await executeRouteTool(deps, { routeId });
    expect(await executeRouteTool(deps, { routeId, confirm: true })).toMatchObject({ executed: false, status: 'PENDING', note: expect.stringMatching(/do not report success/) });
  });
});

describe('execute_route exposure', () => {
  const fakeToolDeps = { gather: async () => ({ venues: [], referenceSep: null, referenceSource: null }), tapeLatest: async () => null, now: () => OPEN, routes: new RouteStore() };
  async function toolNames(withExec: boolean) {
    const [a, b] = InMemoryTransport.createLinkedPair();
    const { deps } = setup();
    await createServer(fakeToolDeps as never, withExec ? deps : undefined).connect(b);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(a);
    return (await client.listTools()).tools.map((t) => t.name);
  }

  it('exists only when execution deps are passed (the local stdio server)', async () => {
    expect(await toolNames(false)).not.toContain('execute_route');
    expect(await toolNames(true)).toContain('execute_route');
  });
});
