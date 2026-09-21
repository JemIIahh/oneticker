# OneTicker: Product and Technical Spec

> Working name. Rename with a find-and-replace on `OneTicker` / `oneticker`.

**One ticker in. The safest fill out, even when Wall Street is closed.**

Entry for **BNB Hack: Tokenized Stocks Edition**.
Submission deadline: **Sunday 11 Oct 2026, 12:00 UTC** (13:00 Lagos). Judging 12 to 23 Oct. Everything must stay live until 23 Oct.

---

## 1. The problem

Every agent or app that touches tokenized stocks on BNB Chain hits three problems today.

1. **One stock, three tokens, three execution paths.** NVIDIA exists as NVDAB (bStocks), NVDAon (Ondo) and an xStocks token. Each has its own liquidity, its own execution path (Ondo: multi-vendor RFQ; bStocks: LiquidMesh / PcsXRfq RFQ; xStocks: AMM pools) and its own constraints (minimum order size, market-maker order limits, exchange-hours gating). There is no canonical resolver. The official Agentic Wallet skill's instruction for a bare ticker is to ask the user which one they meant.
2. **Blind for 80% of the week.** US markets are open about 32.5 of 168 hours. The rest of the time, Binance's bStocks collateral index freezes at the last close, APRO's on-chain feed updates only on a 1-hour heartbeat or a 1% move, and AMM spot keeps trading. An agent buying at 2am on a Saturday cannot tell whether it is paying a premium.
3. **Prices are not comparable at face value.** bStocks use a BEP-677 multiplier for dividends and splits, and all three issuers reinvest dividends (total return). A token's price is not the price of one share. Comparing NVDAB and NVDAon naively gives the wrong answer.

## 2. What OneTicker is

A routing and safety layer for tokenized equities, built once as a core library and delivered four ways.

| Surface | Who uses it | Why it matters for judging |
|---|---|---|
| **MCP server** | Any agent (Claude, Cursor, custom) | There is no official Web3/RWA MCP server; the only Binance MCP is CEX-only |
| **Wallet Skill** (`SKILL.md`) | Agents using Binance Agentic Wallet | Best Use of Agentic Wallet / Wallet Skills ($2,000) |
| **Paid agent on BNB Agent Studio** | Other agents, paying per quote via x402 | Best Use of BNB Agent Studio ($2,000) |
| **Web terminal** | Humans and judges | Product quality and UX (20%) |

Plus one background service, **the Off-Hours Tape**: a logger that records every price surface every 5 minutes, starting in week one. It powers the demo's headline finding and gives the DX report measured numbers instead of anecdotes.

## 3. Core concepts

### 3.1 Instruments and venues

```
Instrument  US:NVDA
  venues:
    bstocks  NVDAB    path: RFQ_BSTOCK   share ratio: BEP-677 uiMultiplier (on-chain)
    ondo     NVDAon   path: RFQ_ONDO     share ratio: issuer-reported
    xstocks  NVDAx    path: AMM          share ratio: issuer-reported
```

The registry is a static, hand-verified JSON file (`packages/core/src/registry/instruments.json`) for **five instruments only**. It is generated and checked by the probe script in T1. Do not auto-discover all 77 bStocks.

**Candidate instruments** (T1 verifies that each issuer lists each one on BSC): NVDA, TSLA, QQQ, CRCL, plus one of META / MSFT / MSTR. If an issuer does not list a ticker on BSC, keep the instrument with two venues and show "not listed on BSC" in the UI. That gap is itself a finding.

### 3.2 Share-equivalent price (SEP)

Every price is normalized to **USD per one underlying share** before any comparison or ranking.

```
sep = tokenPriceUsd / sharesPerToken(venue, now)
```

`sharesPerToken` comes from the venue's share-ratio source: the BEP-677 `uiMultiplier` for bStocks, issuer-reported ratios for Ondo and xStocks (via the Web3 API RWA endpoints). **T1 must establish** whether quoted token prices are per raw unit or per UI unit for bStocks, because the formula depends on it. Record the answer and evidence in `docs/RESEARCH.md`.

### 3.3 Market state

Computed per instrument from an NYSE calendar in `America/New_York`.

| State | When (ET) |
|---|---|
| `REGULAR` | Mon to Fri 09:30 to 16:00 |
| `PRE` | Mon to Fri 04:00 to 09:30 |
| `POST` | Mon to Fri 16:00 to 20:00 |
| `OVERNIGHT` | Sun to Thu 20:00 to 04:00 next day |
| `WEEKEND` | Fri 20:00 to Sun 20:00 |
| `HOLIDAY` | NYSE holiday |
| `HALTED` | Corporate action or issuer pause detected |

Also compute `referenceAgeSec`: seconds since the last real reference trade. This number, not the label, drives the gate.

During the hackathon ET is UTC-4 (US DST ends 1 Nov 2026). The regular session is 13:30 to 20:00 UTC, which is 14:30 to 21:00 in Lagos. There are no NYSE holidays between now and the end of judging.

**Venue executability is separate from market state.** Example: the Web3 API returns error 40369 for bStocks RFQ outside exchange hours, while NVDAB keeps trading on PancakeSwap. The router must model "no API route right now" and "no market right now" as different things.

### 3.4 Price surfaces

For each venue, one snapshot collects:

| Surface | Source | What it tells you |
|---|---|---|
| `reference` | Web3 API `/rwa/price` `referencePrice`, cross-checked against an independent equity quote (Finnhub or similar) | The real market, when it is open |
| `onchain` | Web3 API `/rwa/price` on-chain price | Where the token last traded |
| `executable` | Web3 API aggregator quote at fixed notionals: $100, $1,000, $10,000 | What you would actually pay, including impact |
| `oracle` | APRO feed on BSC: answer and `updatedAt` | What lending protocols believe |
| `index` | Binance bStocks collateral index, if a public endpoint is confirmed | What Binance margin believes; frozen while the US market is closed |

Derived metrics:

- `premiumBps` = (executable SEP / last reference SEP - 1) x 10,000
- `crossIssuerSpreadBps` = best venue SEP vs worst venue SEP
- `oracleAgeSec`, `oracleDivergenceBps` (oracle vs executable)
- `impactBps` = $10,000 quote vs $100 quote

The independent reference matters because `referencePrice` may be derived from the on-chain price rather than a real market quote. If T1 confirms that, the independent quote becomes the primary reference and the finding goes in the DX report.

### 3.5 The Gate

A deterministic, explainable policy. Input: a route and the latest snapshot. Output:

```json
{
  "verdict": "CAUTION",
  "reasons": [
    { "code": "REF_STALE", "detail": "Reference price is 38h 12m old (US market closed since Fri 16:00 ET)" },
    { "code": "PREMIUM_HIGH", "detail": "Paying 112 bps over the last reference price" }
  ],
  "policy": "default@1"
}
```

Starting policy. These thresholds are guesses until the Tape shows what normal looks like; retune in week three. Every threshold lives in one file, `packages/core/policy/default.json`.

| Rule | CAUTION | BLOCK |
|---|---|---|
| Reference age while market closed | over 1h | never on its own |
| Premium vs last reference | over 75 bps | over 200 bps |
| Oracle age | over heartbeat (3,600s) | over 2x heartbeat |
| Oracle vs executable divergence | over 100 bps | over 300 bps |
| Price impact at requested size vs $100 | over 50 bps | over 150 bps |
| Corporate action | multiplier change pending | venue halted |

Venue constraints (for example 40375, below Ondo's minimum) exclude that venue from the route list; they do not block the trade if another venue works.

**The LLM never sets a verdict.** It may only explain one in plain English.

### 3.6 Routes and exclusions

`quote_route` returns every venue, ranked by net SEP after fees and impact. Each entry is either `ok` (with a gate verdict) or `excluded` (with a human-readable reason mapped from the API error code).

| API code | Reason shown to the user |
|---|---|
| 40374 | No liquidity from any vendor right now |
| 40365 | Ondo-only mode is on but this pair has no Ondo token |
| 40366 | Larger than the market maker's single-order limit (try splitting) |
| 40367 | Underlying market is closed; this venue will not quote |
| 40369 | bStocks RFQ is unavailable outside exchange hours |
| 40375 | Below Ondo's minimum order size |

Unknown codes are logged to `events` and `dx/LOG.md` verbatim.

### 3.7 Wait-for-GO intents (should-have)

A conditional order the ecosystem does not have: *"Buy $500 of NVDA through the best venue, but only when the gate says GO. Expire Monday 10:00 ET."*

The agent runtime re-evaluates open intents every 5 minutes and executes through the wallet adapter on GO. This is the autonomous-runtime story for the Agent Studio prize and the "credible execution" story for the Agentic Wallet prize (the Agentic Wallet skill documents that limit orders on Ondo tokens can fail with `Ondo-related tokens cannot be traded`).

## 4. MCP tools

| Tool | Input | Output | Price on the public agent (x402) |
|---|---|---|---|
| `resolve_instrument` | `query` ("nvidia", "NVDA", "NVDAon") | instrument and venues | free |
| `get_market_state` | `instrument` | state, `referenceAgeSec`, next open, next close | free |
| `get_price_surfaces` | `instrument` | snapshot (3.4) and derived metrics | $0.005 |
| `quote_route` | `instrument`, `side`, `amountUsd` | ranked routes, exclusions, gate verdicts, `routeId` | $0.01 |
| `check_gate` | `routeId` | verdict and reasons | free with a quote |
| `get_offhours_report` | `instrument`, `from`, `to` | Tape summary statistics | $0.01 |
| `create_intent` | `instrument`, `side`, `amountUsd`, `expiresAt`, `policy?` | `intentId` | should-have |
| `execute_route` | `routeId`, `confirm` | preview, then tx hash or order id | **local server only** |

Rules:

- Read tools never sign.
- `execute_route` exists only in the local MCP server, never on the public paid agent.
- `execute_route` always returns a preview first and only executes on a second call with `confirm: true`.
- Prices are placeholders; set them once real costs are known.

## 5. Execution

One adapter interface, two implementations.

**`AgenticWalletAdapter`** shells out to `baw ... --json`.
- AMM path: `baw market-order swap`.
- RFQ path: Trading API quote, then EIP-712 payload, then `baw sign-message`, then `POST /order/submit`, then poll `GET /order/{orderId}`.
- T2 and T9 establish whether `baw market-order swap` already routes bStocks and Ondo directly, which would remove the manual RFQ path.

**`DirectSignerAdapter`** uses viem and a local key. It is the fallback if `baw auth signin` fails for us (see open issues #266 and #274 on `binance-skills-hub`), and it is used for automated tests.

Execution happens on **mainnet**: tokenized stocks do not exist on testnet. Use a dedicated hot wallet funded with about $100 of USDT/USDC plus BNB for gas. Trades of $5 to $25. If Ondo's minimum is higher than that, document it; it is a finding, not a blocker.

## 6. Agent Studio integration

- `bag init` a seller agent in `apps/agent`. Business logic in `sellerCore.ts` calls `@oneticker/core`.
- Public face: MCP and x402. Commerce: B402. Register an ERC-8004 identity (gas-free on testnet via MegaFuel sponsorship).
- A small, real use of an LLM: parse natural-language intents ("half a grand of nvidia when it's safe") and write plain-English gate explanations. The agent pays its own LLM bill from x402 revenue (self-refill), which is exactly what the prize criterion names.
- Autonomous runtime: hosts the Wait-for-GO evaluator.
- **Do not rely on the managed trial.** Docs say it lasts 48 hours and the link must stay live until 23 Oct. Deploy to AWS AgentCore (a supported target) or confirm that the runtime can be self-hosted. Ask the organizers in the builder Telegram how long runtime credits last; the hackathon page says "72-24 hours", which contradicts the docs.
- Commerce on BSC testnet, data read from mainnet. Move the identity to mainnet only if time allows.

## 7. Wallet Skill

`skills/oneticker/SKILL.md` teaches any agent that uses `binance-agentic-wallet` to:

1. Resolve bare tickers through OneTicker instead of asking the user.
2. Call `quote_route` and respect the gate before any tokenized-stock `baw` trade.
3. On BLOCK, explain why and offer a Wait-for-GO intent instead of trading.

Install line for the README: `npx skills add <our-github>/oneticker/skills/oneticker`.
Stretch: open a pull request to `binance/binance-skills-hub`.

## 8. Web terminal

Next.js, dark, dense, trader-grade. Three screens.

1. **Instrument** (`/s/NVDA`)
   - Three venue rows side by side: issuer, token, SEP, premium vs reference, executable now or not, gate verdict.
   - **Week clock**: a ring showing open vs dark hours for the week, where "now" sits, and a counter such as "reference frozen for 38h 12m".
   - A 72-hour chart of all price surfaces with closed-market periods shaded.
2. **Route panel** (on the instrument page)
   - Amount input, ranked routes, exclusions in plain English, gate verdict with reasons.
   - Actions: Execute (connected wallet) or Wait for GO.
3. **The Tape** (`/tape`)
   - Weekend premium distribution per issuer.
   - "Did Sunday-night on-chain price predict Monday's open?"
   - Oracle staleness histogram.
   - Binance API latency and error rates (doubles as DX evidence).

Build the shell against saved fixtures in week one so UI work never waits on the backend.

## 9. The Off-Hours Tape

An always-on job that runs every 5 minutes from T3. **It must be live on a hosted machine (not a laptop) by Thursday 24 Sep, 20:00 UTC**, so it has a full day of market-hours data before the first weekend.

SQLite tables:

- `snapshots(ts, instrument, venue, market_state, reference_px, reference_ts, onchain_px, exec_px_100, exec_px_1k, exec_px_10k, oracle_px, oracle_updated_at, index_px, index_frozen, share_ratio, raw_json)`
- `api_calls(ts, endpoint, http_status, latency_ms, error_code, bytes)`: every Binance API call, for the DX report
- `events(ts, instrument, venue, kind, detail)`: multiplier changes, halts, route exclusions, unknown error codes

Keep `raw_json` on everything. Fields will turn out to mean something different from what we assume.

Weekends captured before submission:

| Weekend | US close | US reopen |
|---|---|---|
| 1 | Fri 25 Sep, 20:00 UTC | Mon 28 Sep, 13:30 UTC |
| 2 | Fri 2 Oct, 20:00 UTC | Mon 5 Oct, 13:30 UTC |
| 3 (partial) | Fri 9 Oct, 20:00 UTC | submission at Sun 11 Oct, 12:00 UTC |

The headline research question: **while Wall Street is closed, does on-chain trading of tokenized stocks anticipate the Monday open, and which issuer's token tracks it best?** Answer it with the data, whatever it says. "No, it is noise" is also a publishable finding.

## 10. Demo video (4:00 maximum)

| Time | Beat |
|---|---|
| 0:00 | "It's Saturday. Nasdaq closed 30 hours ago. Your agent wants $1,000 of NVIDIA. Which NVIDIA?" Three tokens on screen. |
| 0:30 | Resolve and route: share-equivalent prices across issuers; exclusions in plain English with the real error codes. |
| 1:30 | The gate: frozen reference, stale oracle, spot premium. Verdict with reasons. A naive swap would have paid X bps more. |
| 2:15 | Agent to agent: Claude, with our Wallet Skill, asks OneTicker, pays per quote via x402, and creates a Wait-for-GO intent. Cut to Monday's open: the gate turns GO and the trade executes through Agentic Wallet, tx on BscScan. |
| 3:15 | The Tape: one chart, one finding from two weekends of data. |
| 3:50 | "One ticker in. The safest fill out." Repo link, MCP install line, skill install line. |

Record the Monday-open segment live on **Mon 5 Oct at 13:30 UTC** (14:30 Lagos). Capture backup footage of the market reopening on Mon 28 Sep, even if only the CLI works by then.

## 11. Scope

**Must** (do not submit without these)
- Resolver for 5 instruments, market state, price surfaces, SEP
- Quote across 3 venues with exclusions, and the gate
- MCP read tools
- Tape running from 24 Sep
- Web terminal: instrument page and route panel
- DX report, README, demo video

**Should**
- Execution through Agentic Wallet (at least one path)
- Agent Studio deployment with ERC-8004 identity and x402 pricing
- Wallet Skill
- `/tape` findings page
- Wait-for-GO intents

**Could**
- BEP-677 multiplier-change alerts
- Venus / Lista position health for wallets holding tokenized stocks as collateral
- B402 Bazaar listing
- Pull request to `binance-skills-hub`

**Won't**
- All 77 tickers, a lending or liquidation engine, options, a fiat on-ramp, a mobile app

## 12. Prior art and how we differ

- **PlumS** (plumstock.xyz): a cross-chain premium/discount table for 9 markets, no execution. We route and gate across three issuers on one chain, and we serve agents, not just people.
- **closing-bell-agent** (github.com/daveaire/closing-bell-agent): a tokenized-stock spread scanner with a BLOCK/REVIEW safety gate, built on the same Web3 API. It is the closest thing to our gate. We differ on cross-issuer resolution and routing, the off-hours market-state model, execution, the MCP and x402 agent surfaces, and the Tape dataset. Cite it in our README, rather than letting a judge find it first.
  README read 21 Sep 2026 (last push 19 Sep). Concrete differences:
  - **Scope:** bStocks and Ondo only ("the hackathon's bStocks/Ondo scope"). We add xStocks as a third venue.
  - **Question asked:** it looks for cross-issuer arbitrage (buy one representation, sell the other). We route a single order to the best issuer.
  - **Off-hours:** a candidate reaches REVIEW only when "the underlying market is open", so off-hours it always blocks. We model off-hours explicitly (reference age, premium vs last reference, oracle staleness) and return GO / CAUTION / BLOCK with reasons, plus Wait-for-GO.
  - **Execution:** "Broadcasting is disabled in code." We execute, capped at $25 on mainnet.
  - **Agent surfaces:** the README describes a CLI, a 15-minute monitor and a web page; no MCP server, x402 pricing or Wallet Skill.
  - **Data:** its monitor logs an event only when a signal clears $1; the Tape records every surface for every venue every 5 minutes.
  - **Worth borrowing:** its gate requires a Transaction API simulation to return `SUCCESS` before a route is eligible. Consider the same check in `execute_route` (T9).
  - **Same finding as ours:** it says Binance documents `referencePrice` as "derived from the onchain token price", and treats it only as a screening signal (our unverified item 1).
- **RWA.xyz, altFINS, PancakeSwap's stocks terminal**: market data and trading interfaces, not agent infrastructure.
