# PLAN.md

Deadline: **Sunday 11 Oct 2026, 12:00 UTC** (13:00 Lagos). Target submission: **Friday 9 Oct**. Saturday and Sunday morning are buffer only.

**Owners.** A = core and data. B = agent and execution. C = product, UI and story. With fewer than three people, follow ticket order and apply the cut line earlier.

**Daily ritual.** 10-minute sync. Before logging off, everyone adds their friction from the day to `dx/LOG.md`.

**Key times (UTC).** US regular session 13:30 to 20:00. Lagos is UTC+1.

---

## Week 1 · Mon 21 Sep to Sun 27 Sep · Foundations and the Tape

### T0 · Setup · All · Mon 21
- [ ] Submit the hacker application form and join the builder Telegram (links on the hackathon page).
- [ ] Start a stopwatch, open the Binance Web3 developer portal, and stop it at the first successful signed API response. Record every step and the total in `dx/LOG.md`. **This measurement only happens once.**
- [x] Public GitHub repo created with this package committed. https://github.com/JemIIahh/oneticker
- [x] pnpm workspace scaffolded to match the layout in `CLAUDE.md`; `pnpm -r test` passes on empty packages.
- [ ] Hosting chosen for always-on services (Railway, Fly, or a small VPS) and a Vercel project for the web terminal.
  - Decided 21 Sep: **Railway** for always-on services, **Vercel** for the web terminal. Railway project `oneticker` created with a `tape` service (deploys `main` from GitHub, `/data` volume for SQLite, idles until T3). Vercel project still to create once `apps/web` exists (T6).

### T1 · Web3 API client and probe · A · Mon 21 to Tue 22
- [x] `packages/clients/web3`: HMAC signing with the `/build` prefix, one rate limiter per endpoint, `OCResult` unwrapping, typed errors, and a hook that records every call for `api_calls`.
- [x] `scripts/probe.ts` calls `rwa/platforms`, `rwa/tokens`, `rwa/search`, `rwa/price`, `rwa/underlying-market`, `market/price`, and an aggregator quote for every candidate venue, saving each response to `fixtures/`. (22 Sep 11:28 UTC: first signed call; 106 fixtures in `fixtures/web3/`.)
- [x] Unverified items 1, 2 and 3 in `docs/RESEARCH.md` answered with fixture evidence. (1: `referencePrice` is derived. 2: prices are per raw token; ratio from `tokenToShareRatio`. 3: yes, all listed; xStocks illiquid.)
- [ ] `instruments.json` written: 5 instruments, up to 3 venues each, addresses and execution paths confirmed.
  - 22 Sep: written by `pnpm registry` from the `bapi` fixtures. NVDA, TSLA, QQQ, CRCL, and **MSTR as the fifth** (team decision; it tracks Bitcoin, which trades all weekend). All 15 addresses confirmed on-chain (`symbol()`, `decimals()`). Execution paths not yet confirmed: `baw` quoted NVDAB and NVDAon; NVDAx had no liquidity pre-market. The probe's `prices` phase checks the rest once API keys arrive.
- [x] closing-bell-agent README read; differences noted in `SPEC.md` section 12.

### T2 · Agentic Wallet smoke test · B · Tue 22
- [x] Install `baw`, sign in from Nigeria, run `wallet status`, `balance`, and a quote for one tokenized stock. (22 Sep: signed in over VPN on the 5th QR; quotes for NVDAB and NVDAon, NVDAx no liquidity.)
- [ ] Unverified items 4 and 5 answered. Every command and its exact output in `dx/LOG.md`. (4: yes, VPN required. 5: quotes yes; swap execution waits for funding.)
- [x] Decision recorded in this file: AgenticWalletAdapter viable, yes or no. If no, B switches to DirectSignerAdapter in T9.
  - **Provisional YES (22 Sep).** Sign-in works over VPN, and `baw market-order quote` handles bStocks and Ondo directly. Confirm with the first funded swap in T9. Constraints: the session ends after 48 h idle and 7 days at most, so someone must re-scan before the 5 Oct demo; `tradeAllTokens` is `false`; `dailyLimit` is 50,000 and should be lowered in the app.
- [ ] Dedicated hot wallet created and funded (about $100 USDT/USDC plus BNB for gas). (Agent wallet created 22 Sep, `baw wallet address`; not funded yet.)

### T3 · Tape v0 · A · Tue 22 to Thu 24
- [x] `apps/tape` runs every 5 minutes on the hosted machine: for each venue, reference, on-chain and executable quotes at $100 / $1,000 / $10,000, plus market state. Writes `snapshots` and `api_calls`. (Raw JSON per venue since 22 Sep 12:11 UTC; column parsing is the remaining step. Reference = Finnhub, pending a key.)
- [x] Oracle and index surfaces may land on Friday if they slow this down. Everything else may not. (Oracle landed 22 Sep; index waits on item 7.)
- [x] **Live by Thu 24 Sep, 20:00 UTC**, so there is a full market day of data before the Friday close. (Live with keys from 22 Sep 12:11 UTC, run 168.)
- [x] A failed run leaves a log line, and a daily row count check flags gaps. (`RUN_FAILED` and `CHECK_GAPS` log lines; `pnpm --filter tape check [day]`.)
- Progress 21 Sep 22:39 UTC: skeleton live on Railway (`pnpm --filter tape start`, DB at `/data/tape.sqlite`). It stores raw responses per venue now; price columns get parsed once T1 fixtures confirm the fields. Blocked on API keys and the T1 registry.

### T4 · Core: market state, SEP, oracle · A and B · Wed 23 to Fri 25
- [x] Market calendar and state engine with unit tests at 10 or more boundary timestamps (Friday close, Sunday 20:00 ET, pre-market open, DST offset). `packages/core/src/market`, 17 boundary cases plus holiday and early close; wired into the Tape's `market_state`.
- [ ] SEP normalization per venue. During market hours, NVDA SEP across all venues lands within a sane band of the reference.
- [x] APRO reader (B): feed addresses found, `answer` and `updatedAt` read; unverified item 6 answered. (22 Sep: `packages/clients/src/chain/`, plus a BEP-677 multiplier reader; both recorded by the Tape every 5 minutes, keys or no keys. MSTRB has no APRO feed.)
- [x] Collateral index surface (B), if a public endpoint exists; unverified item 7 answered either way. (22 Sep: yes, an undocumented `bapi` endpoint, not frozen 3 h after a weekday close; see `docs/RESEARCH.md` item 7. The Tape now records it (`index_px`), plus Binance spot (`cex_px`), the PancakeSwap v3 pool price and depth read from BSC (`pool_px`, `pool_depth_usd`; works even where Binance blocks us), and per instrument the TradFi perp (`underlying` table).)

### T5 · Router and CLI · A · Fri 25 to Sun 27
- [x] `quote_route` logic: quote every venue, rank by net SEP, map error codes to exclusions (SPEC 3.6). (Built early, 22 Sep: `packages/core/src/router/quote.ts`, pure and unit-tested — 10 tests — ready to reuse for the T8 MCP tool.)
- [x] `pnpm oneticker quote NVDA buy 500` prints ranked routes and exclusions for all 5 instruments. (`scripts/cli.ts`; both sides tested for NVDA and MSTR. Degrades to per-venue exclusions when the API is unreachable, which is all we could test today — no VPN connected during this run.)
- [ ] Run it during market hours on Friday and again on Saturday. Save both outputs; this is the first look at off-hours behavior.

### T6 · Terminal design and shell · C · Mon 21 to Sun 27
- [ ] Screens designed: instrument page, route panel, week clock, `/tape`. (22 Sep: first three built as a working shell; `/tape` is a placeholder until weekend-1 data.)
- [x] Next.js shell rendering the instrument page from saved fixtures (no live backend needed). (`apps/web`, 22 Sep. `pnpm --filter web dev`, then `/s/NVDA`; add `?at=2026-09-26T10:12:00Z` to preview a closed-market state.)
- [ ] README draft and demo storyboard started.

**Checkpoint, Sun 27 Sep:** Tape has at least 72 hours of data including a weekend. The CLI quotes all 5 instruments. The shell renders.

---

## Week 2 · Mon 28 Sep to Sun 4 Oct · Make it callable, make it trade

**Mon 28 Sep, 13:30 UTC:** capture backup footage of the US open with whatever works (CLI is fine).

### T7 · Gate · A · Mon 28
- [x] `packages/core/policy/default.json` and the gate engine from SPEC 3.5. (Built early, 22 Sep: `packages/core/src/gate`.)
- [x] A test for every rule, including a weekend fixture that produces CAUTION. (20 tests; the weekend case uses 22 Sep APRO and multiplier numbers.)
- [ ] One short note in `docs/` on what weekend 1 looked like in the Tape, used to sanity-check thresholds.

### T8 · MCP server · A · Tue 29 to Wed 30
- [x] `apps/mcp` exposes `resolve_instrument`, `get_market_state`, `get_price_surfaces`, `quote_route`, `check_gate` over stdio and HTTP.
  - 22 Sep: all five tools, read-only. `quote_route` fetches live (shared with the CLI via `gatherRouteInputs` in `packages/clients`); `get_price_surfaces` reads the Tape's `/api/latest`. The `routeId` is a hash of the exact gate input, and `check_gate` replays the gate on that input (`inputHashMatches`), so verdicts can be checked, not just trusted. HTTP is stateless Streamable HTTP at `/mcp`. Smoke-tested over stdio (SDK client, launched from `/`) and HTTP (curl); one live NVDAon quote came back via LiquidMesh.
- [ ] Works from Claude Code (`claude mcp add ...`) and Claude desktop. Install line in the README.
  - [x] Claude Code, 22 Sep 22:35 UTC: asked "what's the best way to buy $500 of nvidia right now?"; it called oneticker twice, resolved without asking which token, and returned NVDAB $228.33/share CAUTION, NVDAon $229.17 CAUTION, NVDAx excluded (40374), routeId `rt_08c63ecf7f69a848d11c5a5532e58cc2`.
  - [ ] Claude desktop.

### T9 · Execution adapters · B · Mon 28 to Wed 30
- [x] Adapter interface, plus AgenticWalletAdapter or DirectSignerAdapter per the T2 decision. (23 Sep: `packages/clients/src/execution/`; `baw` via `execFile`, no shell; the JSON envelope decides, not the exit code. DirectSignerAdapter not built.)
- [x] `execute_route` in the local MCP server: preview first, execute only with `confirm: true`, $25 cap enforced. (23 Sep: stdio server only, never HTTP. Also refuses BLOCK, CAUTION without `acknowledgeCaution`, quotes over 60 s old, a confirm without a preview in the last 60 s, and a `baw` quote more than 50 bps worse per share than the routed price; one execution per preview; polls `market-order list` to FINISHED/FAILED and never reports a pending order as filled. Sends nothing unless `EXEC_MODE=agentic-wallet`. Live preview 23 Sep, about 06:55 UTC: NVDAon $10, `baw` quote 4.8 bps better than the route, confirm returned `not-sent` under `EXEC_MODE=preview`.)
- [ ] AMM path working first, then RFQ.
- [ ] **At least one real mainnet trade** of $25 or less; tx hash in `dx/LOG.md`. If RFQ fails, its blocker is documented with exact errors.

### T10 · Agent Studio · A · Thu 1 to Sat 3
- [ ] Ask in the builder Telegram how long runtime credits last (docs say 48h; the hackathon page says "72-24 hours"). Keep the answer in `dx/LOG.md`.
- [ ] `bag init` seller agent in `apps/agent`, wrapping core, MCP and x402 faces, prices from SPEC section 4.
- [ ] ERC-8004 identity registered; `bag deploy verify` passes.
- [ ] Deployed to AWS AgentCore or self-hosted, **not** the 48-hour managed trial.
- [ ] A paid quote succeeds after an x402 payment on testnet. The endpoint stays up 72 hours without intervention.

### T11 · Wallet Skill · B · Thu 1
- [x] `skills/oneticker/SKILL.md` per SPEC section 7. (22 Sep: buy and sell flows, verdict table, reason glossary, and a `baw` quote cross-check against OneTicker's per-share price before any swap. `quote_route` routes now carry `address` and `sharesPerToken` for this.)
- [ ] Tested in Claude Code alongside `binance-agentic-wallet`: bare-ticker resolution, gate respected, BLOCK leads to an intent offer. Transcript saved to `docs/skill-demo.md`.
  - 22 Sep, two headless runs in an isolated folder (`docs/skill-demo.md`): bare-ticker resolution and CAUTION handling pass. BLOCK not yet seen live ($50,000 of TSLA showed no price impact), and intents (T12) don't exist yet, so the BLOCK path is still open.

### T12 · Wait-for-GO intents · B · Fri 2 to Sat 3 · *Should; first to cut*
- [ ] `create_intent` tool and an evaluator in the agent runtime that re-checks every 5 minutes and executes on GO, or expires.
- [ ] An intent created over weekend 2 that is ready to fire at Monday's open.

### T13 · Terminal on live data · C · Mon 28 to Sat 3
- [ ] Instrument page and route panel wired to the live core through an API route.
  - 22 Sep: the Tape serves a read-only HTTP API (`/api/latest`, `/api/history`, `/health`) at `https://tape-production-c409.up.railway.app`; the web app reads it when `TAPE_API_URL` is set, refreshes every minute, and falls back to fixtures. Still to do: the route panel's live quotes at the requested size (needs the router, T5), and the reference price (Finnhub).
- [ ] Week clock and 72-hour surfaces chart with closed-market shading.
- [ ] Deployed on Vercel; works at phone width.

**Cut decision, Thu 1 Oct.** If behind, cut in this order: (1) T12 intents, (2) RFQ execution (keep AMM), (3) T10 Agent Studio (keep MCP and the skill), (4) the `/tape` page (put the chart in the README instead).
**Never cut:** the Tape, the gate, MCP read tools, the instrument page, the DX report, the video.

**Sat 3 Oct:** full demo dry run, end to end, following SPEC section 10.

---

## Week 3 · Mon 5 Oct to Sun 11 Oct · Ship

### T14 · Record the Monday open · All · Mon 5, 13:30 UTC (14:30 Lagos)
- [ ] Screen-record the weekend-2 intent turning GO and executing at the open. Without intents, record the gate changing verdict at the open and a manual execute.

### T15 · Tape analysis · A and C · Mon 5 to Tue 6
- [ ] Analysis scripts: weekend premium per issuer, Sunday-night on-chain vs Monday open, oracle staleness, cross-issuer spreads.
- [ ] `/tape` page (C) and a one-sentence headline finding with its chart.
- [ ] `dx/metrics.md` generated from `api_calls`: p50 / p95 latency and error rate per endpoint, and error-code counts.

### T16 · Demo video · C · Wed 7 to Thu 8
- [ ] 4:00 or shorter, following SPEC section 10. Uploaded unlisted.

### T17 · DX report · All · Wed 7 to Thu 8
- [ ] Each person writes their own sections of `dx/REPORT.md` **in their own words**, from `dx/LOG.md` and `dx/metrics.md`.
- [ ] Every claim has a timestamp, a URL or command, and evidence. All seven headings covered.

### T18 · README and submission · All · Fri 9
- [ ] README final: positioning, install lines, architecture, prior art, the headline finding.
- [ ] Every link checked from a logged-out browser. Any key that was ever exposed is rotated.
- [ ] Project submission form sent. **Confirmation received Fri 9 Oct.**

**Sat 10 to Sun 11 Oct, 12:00 UTC:** buffer only. The Tape keeps running through weekend 3.

---

## After submission

- Keep the web terminal, MCP HTTP endpoint, agent, and Tape live until **Fri 23 Oct** (end of judging). Hosting paid through the end of October.
- Keep the Tape running. Weeks of weekend data are worth more than two.
