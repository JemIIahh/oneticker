// execute_route (SPEC 4, T9): local MCP server only, never the public HTTP server or the paid agent.
// Preview first; a second call with confirm: true executes, and only when EXEC_MODE allows it.

import { ExecutionError, USDT_BSC, type ExecutionAdapter, type OrderState, type SwapRequest } from '@oneticker/clients';
import { bps, formatDuration, quoteRoute, type RouteOk } from '@oneticker/core';
import { ToolError, type RouteStore } from './tools';

export type ExecMode = 'preview' | 'agentic-wallet' | 'direct';

export interface ExecDeps {
  routes: RouteStore;
  adapter: ExecutionAdapter;
  mode: ExecMode;
  /** CLAUDE.md: $25 per mainnet trade unless a human raises it. */
  maxUsdPerTrade: number;
  now(): Date;
  sleep(ms: number): Promise<void>;
  previews: Map<string, Preview>;
}

interface Preview {
  routeId: string;
  symbol: string;
  request: SwapRequest;
  createdAt: Date;
}

export const QUOTE_MAX_AGE_SEC = 60;
export const PREVIEW_MAX_AGE_SEC = 60;
/** How far the wallet's own quote may be worse than the routed price before we refuse. */
export const MAX_DRIFT_BPS = 50;

export interface ExecuteArgs {
  routeId: string;
  /** Token symbol of the route to use; default the best route. */
  symbol?: string;
  confirm?: boolean;
  /** Required when the chosen route's verdict is CAUTION, after the user has accepted the reasons. */
  acknowledgeCaution?: boolean;
  slippage?: string;
}

const ageSec = (now: Date, then: Date) => Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
const qty = (n: number) => n.toFixed(8).replace(/\.?0+$/, '');

export async function executeRouteTool(deps: ExecDeps, args: ExecuteArgs) {
  const input = deps.routes.get(args.routeId);
  if (!input) throw new ToolError(`Unknown routeId "${args.routeId}". Call quote_route first.`);
  const now = deps.now();
  const quotedAt = input.now ?? now;
  const quoteAge = ageSec(now, quotedAt);
  if (quoteAge > QUOTE_MAX_AGE_SEC) throw new ToolError(`This quote is ${formatDuration(quoteAge)} old (limit ${QUOTE_MAX_AGE_SEC}s). Call quote_route again for a fresh price and verdict.`);

  if (input.amountUsd > deps.maxUsdPerTrade) {
    throw new ToolError(`$${input.amountUsd} is over the $${deps.maxUsdPerTrade} per-trade limit (EXEC_MAX_USD_PER_TRADE). Quote a smaller amount; only a human can raise the limit.`);
  }

  const result = quoteRoute(input);
  const route: RouteOk | undefined = args.symbol ? result.routes.find((r) => r.symbol.toLowerCase() === args.symbol!.toLowerCase()) : result.routes[0];
  if (!route) {
    const why = result.excluded.map((e) => `${e.symbol}: ${e.reason} (${e.code})`).join('; ');
    throw new ToolError(args.symbol ? `${args.symbol} is not an executable route in this quote. ${why}` : `No venue can fill this order. ${why}`);
  }

  const reasons = route.gate.reasons.map((r) => `${r.code}: ${r.detail}`);
  if (route.gate.verdict === 'BLOCK') throw new ToolError(`The gate says BLOCK for ${route.symbol}; this will not execute. ${reasons.join('; ')}`);
  if (route.gate.verdict === 'CAUTION' && !args.acknowledgeCaution) {
    throw new ToolError(
      `The gate says CAUTION for ${route.symbol}: ${reasons.join('; ')}. Show these reasons to the user; only if they accept them, call again with acknowledgeCaution: true.`,
    );
  }

  const pxPerToken = route.sep * route.sharesPerToken;
  const request: SwapRequest =
    input.side === 'buy'
      ? { fromToken: USDT_BSC, toToken: route.address as `0x${string}`, fromTokenQty: qty(input.amountUsd), ...(args.slippage ? { slippage: args.slippage } : {}) }
      : { fromToken: route.address as `0x${string}`, toToken: USDT_BSC, fromTokenQty: qty(input.amountUsd / pxPerToken), ...(args.slippage ? { slippage: args.slippage } : {}) };

  // The wallet's own quote, converted to per share and compared with the routed price.
  let walletQuote;
  try {
    walletQuote = await deps.adapter.quote(request);
  } catch (error) {
    if (error instanceof ExecutionError) throw new ToolError(`The wallet could not quote: ${error.message} (${error.errorName} ${error.code}).`);
    throw error;
  }
  const walletPxPerToken = input.side === 'buy' ? walletQuote.fromAmount / walletQuote.toAmount : walletQuote.toAmount / walletQuote.fromAmount;
  const walletSep = walletPxPerToken / route.sharesPerToken;
  const driftBps = input.side === 'buy' ? bps(walletSep, route.sep) : -bps(walletSep, route.sep);
  if (!Number.isFinite(driftBps) || driftBps > MAX_DRIFT_BPS) {
    throw new ToolError(
      `The wallet's quote is ${Math.round(driftBps)} bps worse than the routed price ($${walletSep.toFixed(2)} vs $${route.sep.toFixed(2)} per share; limit ${MAX_DRIFT_BPS} bps). The price has moved: call quote_route again.`,
    );
  }

  const summary = {
    routeId: args.routeId,
    side: input.side,
    amountUsd: input.amountUsd,
    route: { symbol: route.symbol, issuer: route.issuer, address: route.address, sep: route.sep, verdict: route.gate.verdict, reasons: route.gate.reasons },
    wallet: { adapter: deps.adapter.name, quote: { from: `${walletQuote.fromAmount} ${walletQuote.fromSymbol}`, to: `${walletQuote.toAmount} ${walletQuote.toSymbol}`, slippage: walletQuote.slippage }, sep: walletSep, driftBps },
    swap: request,
    limits: { maxUsdPerTrade: deps.maxUsdPerTrade, quoteAgeSec: quoteAge, execMode: deps.mode },
  };

  const key = `${args.routeId}:${route.symbol}`;
  if (!args.confirm) {
    deps.previews.set(key, { routeId: args.routeId, symbol: route.symbol, request, createdAt: now });
    return {
      stage: 'preview',
      executed: false,
      ...summary,
      next:
        deps.mode === 'agentic-wallet'
          ? `Show this to the user. If they confirm, call execute_route again with the same routeId${args.symbol ? ' and symbol' : ''} and confirm: true within ${PREVIEW_MAX_AGE_SEC}s.`
          : `EXEC_MODE is "${deps.mode}", so a confirmed call will not send anything.`,
    };
  }

  const preview = deps.previews.get(key);
  if (!preview || ageSec(now, preview.createdAt) > PREVIEW_MAX_AGE_SEC) {
    throw new ToolError(`No preview for this route in the last ${PREVIEW_MAX_AGE_SEC}s. Call execute_route without confirm first and show the preview to the user.`);
  }
  deps.previews.delete(key); // One execution per preview: a retry needs a new preview.

  if (deps.mode !== 'agentic-wallet') {
    return { stage: 'not-sent', executed: false, ...summary, reason: `EXEC_MODE is "${deps.mode}". Nothing was sent. A human sets EXEC_MODE=agentic-wallet to allow real trades.` };
  }

  let orderId: string;
  try {
    orderId = (await deps.adapter.swap(preview.request)).orderId;
  } catch (error) {
    if (error instanceof ExecutionError) throw new ToolError(`The wallet refused the swap: ${error.message} (${error.errorName} ${error.code}). Nothing was executed.`);
    throw error;
  }

  // An orderId is a submission, not a fill (binance-agentic-wallet, market-order.md): poll to a terminal state.
  let state: OrderState | null = null;
  for (let i = 0; i < 20; i++) {
    await deps.sleep(3_000);
    try {
      state = await deps.adapter.status(orderId);
    } catch {
      continue; // The order can take a moment to appear in the list.
    }
    if (state.status !== 'PENDING') break;
  }
  return {
    stage: 'submitted',
    executed: state?.status === 'FINISHED',
    ...summary,
    orderId,
    status: state?.status ?? 'UNKNOWN',
    txHash: state?.txHash ?? null,
    ...(state?.status === 'FINISHED' && state.txHash ? { explorer: `https://bscscan.com/tx/${state.txHash}` } : {}),
    ...(state?.status !== 'FINISHED' ? { note: 'Not confirmed as filled. Check again with `baw market-order list --orderId <orderId> --json`; do not report success yet.' } : {}),
  };
}
