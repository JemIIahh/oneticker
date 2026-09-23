# OneTicker

**One ticker in. The safest fill out, even when Wall Street is closed.**

A routing and safety layer for tokenized stocks on BNB Chain. Built for BNB Hack: Tokenized Stocks Edition.

> Status: in development for the 11 Oct 2026 submission. Working today: core library, CLI, MCP server (read tools plus local `execute_route` in preview mode), Wallet Skill, the Tape. Not yet: a funded mainnet trade, the Agent Studio agent, the `/tape` findings page.

## The problem

- **One stock, three tokens.** NVIDIA trades on BNB Chain as NVDAB (bStocks), NVDAon (Ondo) and an xStocks token, each with its own liquidity, execution path and limits. Nothing tells an agent which one to use.
- **Blind 80% of the week.** US markets are open about 32 of 168 hours. The rest of the time reference prices freeze, oracles go stale, and on-chain prices keep moving.
- **Prices do not compare at face value.** Dividend reinvestment and BEP-677 multipliers mean a token's price is not the price of one share.

## What OneTicker does

Give it a ticker and an amount. It resolves every issuer's token, normalizes prices to one share, quotes every execution path, tells you which venues cannot fill and why in plain English, and runs a deterministic safety gate that returns GO, CAUTION or BLOCK with reasons.

Delivered four ways from one core:

| Surface | For |
|---|---|
| MCP server | Any agent: Claude, Cursor, custom frameworks |
| Wallet Skill | Agents trading through Binance Agentic Wallet |
| Paid agent on BNB Agent Studio | Other agents, paying per quote via x402 |
| Web terminal | People |

## The Off-Hours Tape

Every five minutes, OneTicker records every price surface for five tokenized stocks (NVDA, TSLA, QQQ, CRCL, MSTR) across three issuers. It has run since 22 Sep 2026; the pool, index and perp surfaces were added on 23 Sep.

| Surface | Source |
|---|---|
| On-chain last price | Binance Web3 API `rwa/price`, `market/price` |
| Executable quotes at $100, $1,000, $10,000 | Binance Web3 API aggregator |
| Oracle | APRO feeds on BSC |
| Pool mid price and depth | PancakeSwap v3, read directly from BSC |
| Collateral index and spot price | Binance (bStocks margin index, spot pair) |
| 24/7 reference | Binance TradFi perpetual on the underlying (mark, index, funding) |

Every Binance call is logged with its latency and error code, which feeds the DX report.

**Headline finding:** *(filled in after two weekends of data)*

## Quick start

```bash
git clone https://github.com/JemIIahh/oneticker && cd oneticker
pnpm i && pnpm -r build

# CLI
pnpm oneticker quote NVDA buy 500

# MCP server for Claude Code (stdio)
claude mcp add oneticker -- node "$PWD/apps/mcp/bin/oneticker-mcp.mjs"

# Wallet Skill (needs the MCP server and binance-agentic-wallet)
npx skills add JemIIahh/oneticker/skills/oneticker
```

Copy `.env.example` to `.env` and add Binance Web3 API keys for live quotes. Without them, every venue shows as excluded with a reason.

## MCP tools

| Tool | What it does |
|---|---|
| `resolve_instrument` | "nvidia", "NVDA", "NVDAon" or a contract address to one instrument and its token on each issuer |
| `get_market_state` | US session state, how old the last real reference price is, next open and close |
| `get_price_surfaces` | Every surface from the latest Tape snapshot, per share, with impact, oracle divergence and cross-issuer spread |
| `quote_route` | Live quotes on every issuer, ranked per share, each with a GO / CAUTION / BLOCK verdict and reasons; exclusions in plain English |
| `check_gate` | Replays the gate on the exact input a quote saw; the `routeId` is a hash of that input |
| `execute_route` | **Local stdio server only.** Preview first, then `confirm: true`; trades through the Binance Agentic Wallet |

## Safety

- **The gate is deterministic code.** Same input, same verdict. An LLM may explain a verdict, never set one. Thresholds live in one file, [`packages/core/policy/default.json`](packages/core/policy/default.json).
- **Verdicts are replayable.** `routeId` is a SHA-256 of everything the gate saw, and `check_gate` recomputes the verdict from it.
- **`execute_route` never runs from the public server.** It refuses BLOCK, and refuses CAUTION unless the user accepted the reasons. It also refuses quotes older than 60 s, trades over the per-trade cap ($25 by default), and wallet quotes more than 50 bps worse per share than the routed price. It needs a preview and then a confirmation. It sends nothing unless `EXEC_MODE=agentic-wallet`.
- **Prices are compared per share.** BEP-677 multipliers and issuer share ratios are applied before any ranking. A venue whose share ratio is unknown is excluded, not guessed.

## What we found so far

Each is verified against saved API responses; details and evidence in [`docs/RESEARCH.md`](docs/RESEARCH.md) and [`dx/LOG.md`](dx/LOG.md).

- **Binance's `referencePrice` is not a market quote.** It is the token price divided by the token-to-share ratio, so a premium measured against it is measured against itself.
- **The same token fills from different venues from one quote to the next.** Every bStocks and Ondo quote is LiquidMesh `SWAP`, but the filling venue switches between RFQ makers and AMM-style pools.
- **xStocks on BSC have no liquidity.** All five tokens return `40374` for a $100 quote.
- **The bStocks collateral index was not frozen after the close.** Binance's FAQ says it stays fixed while the US market is closed. On a weekday evening, three hours after the close, it moved on every poll. It equals the TradFi perp's index price.
- **The Web3 API geo-blocks by exit country, with an undocumented code.** `40304 "compliance restriction"` came back from US, Singapore and Netherlands servers, but not from a French exit.

## Where this fits

The hackathon lists ten suggested builds. Three of them (cross-protocol arbitrage, reference price monitoring, and MCP/SDK wrappers) need the same foundation: resolve the right token, know whether the market is open, compare prices correctly, and refuse bad fills. OneTicker is that foundation, packaged so the other seven ideas can be built on top of it.

## Architecture

```
            +-------------------- @oneticker/core --------------------+
            | registry | market state | surfaces | SEP | router | gate |
            +---------------------------------------------------------+
                 |             |              |              |
            MCP server    Wallet Skill   Agent Studio    Web terminal
                                          (x402, ERC-8004)
                 |
   Binance Web3 API . APRO oracle . PancakeSwap v3 (BSC) . Binance spot, index, perps . Agentic Wallet (baw)
```

## Prior art

- [PlumS](https://plumstock.xyz): cross-chain premium and discount table. No execution, no agent interface.
- [closing-bell-agent](https://github.com/daveaire/closing-bell-agent): spread scanner with a safety gate on the same API. OneTicker adds cross-issuer routing, an off-hours market model, execution, agent surfaces, and a longitudinal dataset.

## Developer Experience Report

See [`dx/REPORT.md`](dx/REPORT.md). Raw, timestamped evidence is in [`dx/LOG.md`](dx/LOG.md); measured API latency and error rates are in `dx/metrics.md`.

## Disclaimer

Tokenized stocks are not available to US persons or residents of several other jurisdictions. OneTicker is research software, not investment advice.
