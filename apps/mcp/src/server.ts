// The OneTicker MCP server (T8, SPEC 4): read tools over one core. No tool here signs anything; execute_route
// (T9) will live only in the local server and always preview first.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { checkGateTool, marketStateTool, priceSurfacesTool, quoteRouteTool, resolveTool, ToolError, type ToolDeps } from './tools';

export const SERVER_INFO = { name: 'oneticker', version: '0.1.0' };

const INSTRUCTIONS = `OneTicker routes and safety-checks tokenized US stocks on BNB Chain across three issuers: bStocks (symbol suffix B), Ondo (suffix on) and xStocks (suffix x).
Coverage: NVDA, TSLA, QQQ, CRCL, MSTR.
- Given a bare ticker or company name, call resolve_instrument instead of asking the user which token they meant.
- Before any tokenized-stock trade, call quote_route and respect the verdict: GO proceed; CAUTION tell the user the reasons first; BLOCK do not trade.
- All prices are share-equivalent (SEP): USD per one underlying share, after BEP-677 multipliers and issuer share ratios. Never compare raw token prices across issuers.
- Verdicts come from deterministic code. Explain the reasons in plain English; never override or reinterpret a verdict.`;

/** Numbers trimmed to 8 significant digits so agents are not handed float noise; the underlying values are untouched. */
function text(value: unknown): CallToolResult {
  const body = JSON.stringify(value, (_k, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(8)) : v), 2);
  return { content: [{ type: 'text', text: body }] };
}

async function run(fn: () => unknown): Promise<CallToolResult> {
  try {
    return text(await fn());
  } catch (error) {
    if (error instanceof ToolError) return { isError: true, content: [{ type: 'text', text: error.message }] };
    throw error;
  }
}

const instrumentArg = z.string().min(1).max(64).describe('Ticker (NVDA), company name (nvidia), issuer token symbol (NVDAon) or BSC contract address');
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

export function createServer(deps: ToolDeps): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });

  server.registerTool(
    'resolve_instrument',
    {
      title: 'Resolve a ticker',
      description: 'Resolve a ticker, company name, token symbol or contract address to one instrument and its token on each issuer (bStocks, Ondo, xStocks).',
      inputSchema: { query: instrumentArg },
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    ({ query }) => run(() => resolveTool(query)),
  );

  server.registerTool(
    'get_market_state',
    {
      title: 'US market state',
      description:
        'Whether the US regular session is open (REGULAR, PRE, POST, OVERNIGHT, WEEKEND, HOLIDAY), how old the last real reference price is, and the next open and close.',
      inputSchema: { instrument: instrumentArg },
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    ({ instrument }) => run(() => marketStateTool(deps, instrument)),
  );

  server.registerTool(
    'get_price_surfaces',
    {
      title: 'Price surfaces',
      description:
        "Every price surface for one instrument from the newest 5-minute Tape snapshot, in share-equivalent USD: on-chain, executable at $100 / $1k / $10k, APRO oracle, with price impact, oracle divergence and the cross-issuer spread. Up to 5 minutes old; use quote_route for a live quote at a specific size.",
      inputSchema: { instrument: instrumentArg },
      annotations: { ...READ_ONLY, idempotentHint: false, openWorldHint: true },
    },
    ({ instrument }) => run(() => priceSurfacesTool(deps, instrument)),
  );

  server.registerTool(
    'quote_route',
    {
      title: 'Quote and rank routes',
      description:
        'Quote every issuer live for one order, ranked by share-equivalent price, each with a GO / CAUTION / BLOCK gate verdict and reasons. Venues that cannot fill are listed under excluded with a plain-English reason. Returns a routeId for check_gate. Read-only: nothing is traded.',
      inputSchema: {
        instrument: instrumentArg,
        side: z.enum(['buy', 'sell']),
        amountUsd: z.number().positive().max(1_000_000).describe('Order size in USD'),
        includeInput: z.boolean().optional().describe('Also return the exact gate input, so the verdict can be replayed with @oneticker/core'),
      },
      annotations: { ...READ_ONLY, idempotentHint: false, openWorldHint: true },
    },
    (args) => run(() => quoteRouteTool(deps, args)),
  );

  server.registerTool(
    'check_gate',
    {
      title: 'Replay a gate verdict',
      description:
        "Re-run the deterministic safety gate on the exact input a quote_route call saw (by routeId) and return each venue's verdict and reasons. The routeId is a hash of that input, so the replay is checkable. Warns when the quote is stale.",
      inputSchema: { routeId: z.string().regex(/^rt_[0-9a-f]{32}$/).describe('The routeId returned by quote_route') },
      annotations: { ...READ_ONLY, openWorldHint: false },
    },
    ({ routeId }) => run(() => checkGateTool(deps, routeId)),
  );

  return server;
}
