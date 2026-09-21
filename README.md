# OneTicker

**One ticker in. The safest fill out, even when Wall Street is closed.**

A routing and safety layer for tokenized stocks on BNB Chain. Built for BNB Hack: Tokenized Stocks Edition.

> Status: in development. Submission 11 Oct 2026.

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

From 24 Sep 2026, OneTicker logs every price surface for five tokenized stocks across three issuers every five minutes: reference, on-chain, executable quotes at three sizes, oracle, and index.

**Headline finding:** *(filled in week three)*

## Quick start

```bash
# MCP server (Claude Code)
claude mcp add oneticker -- npx @oneticker/mcp        # final command TBD

# Wallet Skill
npx skills add <our-github>/oneticker/skills/oneticker

# Run locally
pnpm i && pnpm -r build
pnpm oneticker quote NVDA buy 500
```

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
      Binance Web3 API  .  APRO oracle  .  BSC  .  Agentic Wallet (baw)
```

## Prior art

- [PlumS](https://plumstock.xyz): cross-chain premium and discount table. No execution, no agent interface.
- [closing-bell-agent](https://github.com/daveaire/closing-bell-agent): spread scanner with a safety gate on the same API. OneTicker adds cross-issuer routing, an off-hours market model, execution, agent surfaces, and a longitudinal dataset.

## Developer Experience Report

See [`dx/REPORT.md`](dx/REPORT.md). Raw, timestamped evidence is in [`dx/LOG.md`](dx/LOG.md); measured API latency and error rates are in `dx/metrics.md`.

## Disclaimer

Tokenized stocks are not available to US persons or residents of several other jurisdictions. OneTicker is research software, not investment advice.
