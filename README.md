# OneTicker

**One ticker in. The safest fill out, even when Wall Street is closed.**

A routing and safety layer for tokenized stocks on BNB Chain. Built for BNB Hack: Tokenized Stocks Edition.

## Status

Checked on 6 October 2026. Each row points at the evidence.

| Part | State | Evidence |
|---|---|---|
| Core library: registry, market clock, per-share prices, router, gate | Working. 70 tests, including a boundary test for every gate rule | [`packages/core`](packages/core) |
| CLI | Working: `pnpm oneticker quote NVDA buy 500` ranks routes and explains exclusions | [`scripts/cli.ts`](scripts/cli.ts) |
| MCP server | Working: five read tools, plus a local `execute_route` that previews and sends nothing in `EXEC_MODE=preview`. 30 tests | [`apps/mcp`](apps/mcp) |
| Wallet Skill | Written and tried twice in Claude Code: bare-ticker resolution and a CAUTION verdict pass. A BLOCK has not appeared live | [`skills/oneticker`](skills/oneticker), [`docs/skill-demo.md`](docs/skill-demo.md) |
| The Tape | Recording since 22 Sep, with gaps. It ran on Railway until the trial ended on 23 Sep, then elsewhere, and it recorded about half of the possible runs over weekend 2 | [`docs/tape-findings.md`](docs/tape-findings.md) |
| Web terminal | Built: route panel, stock pages, a 72-hour chart and `/tape`. Run it locally with `pnpm --filter web dev` | [`apps/web`](apps/web) |
| Mainnet trade | **None yet.** `EXEC_MODE=preview`, wallet unfunded | [`docs/RESEARCH.md`](docs/RESEARCH.md) |
| Agent Studio agent, x402, intents | **Not built.** Cut for time | [`PLAN.md`](PLAN.md) |

182 tests pass across five packages (`pnpm -r test`).

## The problem

- **One stock, three tokens.** NVIDIA trades on BNB Chain as NVDAB (bStocks), NVDAon (Ondo) and an xStocks token, each with its own liquidity, execution path and limits. Nothing tells an agent which one to use.
- **Blind 80% of the week.** US markets are open about 32 of 168 hours. The rest of the time reference prices freeze, oracles go stale, and on-chain prices keep moving.
- **Prices do not compare at face value.** Dividend reinvestment and BEP-677 multipliers mean a token's price is not the price of one share.

## What OneTicker does

Give it a ticker and an amount. It resolves every issuer's token, normalizes prices to one share, quotes every execution path, tells you which venues cannot fill and why in plain English, and runs a deterministic safety gate that returns GO, CAUTION or BLOCK with reasons, cross-checking against the live 24/7 perp while Wall Street is closed.

Delivered from one core:

| Surface | For |
|---|---|
| MCP server | Any agent: Claude, Cursor, custom frameworks |
| Wallet Skill | Agents trading through Binance Agentic Wallet |
| Paid agent on BNB Agent Studio | Other agents, paying per quote via x402. **Not built; cut on 6 Oct.** |
| Web terminal | People |

## The Off-Hours Tape

Every five minutes, OneTicker records every price surface for five tokenized stocks (NVDA, TSLA, QQQ, CRCL, MSTR) across three issuers. It has run since 22 Sep 2026; the pool, index and perp surfaces were added on 23 Sep. It runs in Docker (`docker compose up -d --build`); Binance's Web3 API answers only from some countries, so the recorder needs a host in one of them.

| Surface | Source |
|---|---|
| On-chain last price | Binance Web3 API `rwa/price`, `market/price` |
| Executable quotes at $100, $1,000, $10,000 | Binance Web3 API aggregator |
| Oracle | APRO feeds on BSC |
| Pool mid price and depth | PancakeSwap v3, read directly from BSC |
| Collateral index and spot price | Binance (bStocks margin index, spot pair) |
| 24/7 reference | Binance TradFi perpetual on the underlying (mark, index, funding) |

Every Binance call is logged with its latency and error code, which feeds the DX report.

**First weekend (Fri 2 Oct 20:00 to Mon 5 Oct 13:30 UTC):** in every weekend sample, the on-chain bStocks pool was within 36 bps of the 24/7 perp, so we saw no weekend premium. What differed was the issuer. At $1,000, Ondo was more than 10% above bStocks in 45% of weekend samples, bStocks was cheaper in 78%, and xStocks never returned a quote. The Tape recorded about half of the possible runs (it ran on a laptop that slept and lost its VPN), so this is a first look rather than a distribution. Method, every table and the caveats: [`docs/tape-findings.md`](docs/tape-findings.md), regenerated with `pnpm --filter tape analyze`.

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

# The Tape (price recorder) in Docker, then the analysis behind /tape
docker compose up -d --build
pnpm --filter tape analyze
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
- **Ondo's quotes fall apart with size.** At $1,000 Ondo was more than 10% above bStocks in 45 to 64% of samples, and at $10,000 in 77 to 96%, routed through thin pools. Always choosing bStocks over Ondo cost about 2 bps on average.
- **The gate's reference-age rule fires on 95% of closed-hour samples by itself.** With a last-close reference the verdict is CAUTION for nearly every closed hour whatever the prices do. So on 6 Oct the gate gained a cross-check against the live 24/7 perp while the US market is closed (`PERP_DIVERGENCE`, policy `default@2`): in the weekend data it fired on 2 of 1,933 closed-hour samples, and every stale-reference CAUTION now says how far the price sits from the perp. The thresholds (75 and 200 bps) are guesses; the weekend never tested them.
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
                              (not built: x402, ERC-8004)
                 |
   Binance Web3 API . APRO oracle . PancakeSwap v3 (BSC) . Binance spot, index, perps . Agentic Wallet (baw)
```

## Prior art

- [PlumS](https://plumstock.xyz): cross-chain premium and discount table. No execution, no agent interface.
- [closing-bell-agent](https://github.com/daveaire/closing-bell-agent): spread scanner with a safety gate on the same API. OneTicker adds cross-issuer routing, an off-hours market model, execution, agent surfaces, and a longitudinal dataset.

## Developer Experience Report

See [`dx/REPORT.md`](dx/REPORT.md). Raw, timestamped evidence is in [`dx/LOG.md`](dx/LOG.md); measured API latency and error rates are in [`dx/metrics.md`](dx/metrics.md).

## Disclaimer

Tokenized stocks are not available to US persons or residents of several other jurisdictions. OneTicker is research software, not investment advice.
