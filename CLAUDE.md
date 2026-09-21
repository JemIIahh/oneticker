# CLAUDE.md

## What this is

**OneTicker**: a routing and safety layer for tokenized stocks on BNB Chain (bStocks, Ondo, xStocks), built for BNB Hack: Tokenized Stocks Edition.

**Hard deadline: Sunday 11 Oct 2026, 12:00 UTC.** Everything must stay live until judging ends on 23 Oct.

- `SPEC.md`: what we are building and why. Read it before your first ticket.
- `PLAN.md`: tickets, owners, dates, acceptance criteria. Work from here.
- `docs/RESEARCH.md`: facts about the APIs and market, each marked verified or unverified.

## How to work in this repo

- Work one ticket at a time from `PLAN.md`. Say which ticket you are on. When you finish, tick its acceptance criteria in `PLAN.md`.
- Ship small, working, deployed increments. Do not scaffold things no ticket asks for.
- Scope is capped at **5 instruments**. Do not add tickers.
- The first time you hit any endpoint, save the raw response to `fixtures/<module>/<endpoint>-<utc-timestamp>.json`. **Build types from fixtures, not from the docs.**
- When a real response confirms or disproves something in `docs/RESEARCH.md`, update its status with the date and the fixture path.

## DX evidence (25% of the score)

When the Binance / BNB stack causes friction, append a raw entry to `dx/LOG.md` using the format at the top of that file: UTC timestamp, surface, exact URL or command, expected, actual (paste the error or output), estimated time lost.

Facts only, no prose, no opinions. Friction includes: wrong or missing docs, confusing errors, fields that mean something unexpected, auth failures, contradictions between official sources, CLI bugs, surprising latency.

**Never write or rewrite prose in `dx/REPORT.md`.** The humans on the team write it in their own words. The hackathon rejects AI-generated reports.

## Stack

- TypeScript, **Node 22+**, **pnpm 10** workspaces via Corepack. Agent Studio requires both, so this is not negotiable.
- `viem` for BSC reads: ERC-20, BEP-677 multiplier, APRO feeds.
- `@modelcontextprotocol/sdk` for the MCP server.
- `better-sqlite3` for the Tape.
- Next.js (App Router) and Tailwind for the web terminal.
- `vitest` for tests.
- CLIs: `bag` (`@bnbagent/studio-cli`, Agent Studio) and `baw` (`@binance/agentic-wallet`, Agentic Wallet).

## Layout

```
packages/core      registry, market calendar and state, surfaces, SEP math, router, gate
                   (pure logic; all I/O goes through injected clients)
packages/clients   Web3 API client (HMAC), APRO reader, reference quote client, baw wrapper,
                   execution adapters
apps/tape          5-minute logger and analysis scripts
apps/mcp           local MCP server (stdio and HTTP)
apps/agent         Agent Studio seller agent (created with `bag init` in T10)
apps/web           Next.js terminal
skills/oneticker   Wallet Skill (SKILL.md)
fixtures/          raw API responses
dx/                DX evidence log (LOG.md) and the human-written report (REPORT.md)
docs/              research notes
```

## Commands

Fill these in as scripts are added (T0).

Workspace packages export their TypeScript source directly (`exports` points at `src/index.ts`), so there is no dist to go stale. `pnpm -r build` is a typecheck (TypeScript 7, `noEmit`). Tests colocate as `src/**/*.test.ts`.

```
pnpm i
pnpm -r build                  # typecheck every package
pnpm -r test
pnpm build                     # all packages plus scripts/
pnpm probe discover            # T1: platforms, token lists, search; saves fixtures/web3/
pnpm probe prices              # T1: prices and quotes for scripts/probe-targets.json
pnpm --filter tape once        # one logger run
pnpm --filter tape start       # logger every 5 minutes
pnpm --filter mcp dev
pnpm --filter web dev
pnpm oneticker quote NVDA buy 500
```

## Binance Web3 API: known gotchas

- Base URL `https://web3.binance.com/build`.
- Auth headers: `X-OC-APIKEY`, `X-OC-TIMESTAMP` (ISO 8601 with milliseconds), `X-OC-SIGN` = base64(HMAC-SHA256(secret, timestamp + METHOD + path + body)). Optional `X-OC-RECV-WINDOW` (default 5s).
- **The signed path must include the `/build` prefix**, e.g. `/build/api/v1/dex/market/rwa/price`. The docs call omitting it the leading cause of signature failures.
- Rate limits: **5 req/s per endpoint**, 1,200 per minute per key and per IP. Use one limiter per endpoint inside the client. On 429, respect `Retry-After`.
- Responses use an `OCResult<T>` envelope. **Error shape confirmed 21 Sep** (`fixtures/web3/rwa-platforms-unsigned-20260921T153507Z.json`): `{ "msg", "data": "", "code": 40101, "timestamp" }` with HTTP 401, i.e. `msg` not `message`, numeric `code`, **no `success` field**. Success shape not yet seen. The client treats `success` if present, else `code == 0`. Error responses carry an `x-oc-blocked-by` header (e.g. `AuthenticationFilter/40101`) and `x-oc-trace-id`.
- Auth errors: 40101 invalid key, 40102 signature mismatch, 40103 expired or replayed timestamp, 40104 insufficient permissions.
- **Equity tokens trade via RFQ** (EIP-712 signature plus settlement polling), not the normal swap path.
- Trading error codes to map: 40365, 40366, 40367, 40369, 40374, 40375 (see SPEC 3.6).
- Log every call (endpoint, status, latency, error code) to the Tape's `api_calls` table via a hook in the client.
- The official connector `@binance-web3/wallet` (github.com/binance/binance-web3-connector-js) covers every module despite its name, and is the best reference for endpoint paths and params while the docs are unreachable. We still hand-roll the client: the connector drops the envelope `code`, hides raw responses (we need them for fixtures and `raw_json`), and cannot send a body to `POST /market/price`.
- Signing, confirmed from the connector source: the signed path is `/build` + path + `?query` exactly as sent (URL-encoded); timestamp is `new Date().toISOString()`. Chain param is `binanceChainId` (`"56"` for BSC). RFQ quotes (Ondo, bStocks) need `userWalletAddress`.
- **`web3.binance.com` and `www.binance.com` time out from the Lagos dev network** (dx/LOG.md, 21 Sep 13:50). `api.binance.com` and BSC RPC work. Railway `sfo` reaches the API in about 360 ms (`pnpm reach`, 21 Sep 15:35). Over the team VPN the laptop reaches it too, at about 2.9 s (21 Sep 22:16): fine for probing and development, but latency numbers for the DX report come from the Railway Tape only. The docs return an empty page to scripts (AWS WAF challenge); read them in a browser.
- The docs are client-side rendered. If a fetch returns an empty page, open it in a browser.

## Tokenized stock facts

- Symbol suffixes: bStocks `B` (NVDAB), Ondo `on` (NVDAon), xStocks `x` (verify in T1).
- bStocks are BEP-20 plus **BEP-677**: `balanceOf` never changes on a dividend or split; `uiMultiplier` does. Never cache balances across a multiplier change. Treat a `uiAmount` of 0 on a non-zero raw balance as the overflow case, not as an empty balance.
- All three issuers reinvest dividends (total return). Token price is not the price of one share. **Always compare in SEP** (SPEC 3.2).
- US regular session 09:30 to 16:00 ET. Until 1 Nov 2026, ET is UTC-4: 13:30 to 20:00 UTC, 14:30 to 21:00 Lagos. No NYSE holidays before 23 Oct.
- Binance's bStocks collateral index freezes at the last close while the US market is closed.
- APRO tokenized-equity feeds on BSC: 1-hour heartbeat, 1% deviation threshold. bStocks feeds have been free to builders since 17 Sep 2026.

## Safety rules (non-negotiable)

- Never commit `.env`, private keys, keystores, `.studio/wallets/`, or `baw` session files. Check `git status` before every commit.
- Signing code lives only in `packages/clients` execution adapters and the local MCP server's `execute_route`. Never expose signing as a tool on the public agent.
- `execute_route` returns a preview first and executes only on a second call with `confirm: true`.
- Mainnet trades only from the dedicated hot wallet, **maximum $25 per trade**, unless a human raises the limit in the conversation.
- The gate is deterministic code. An LLM may explain a verdict, never set one.

## Unverified assumptions

Check these before building on them. Full list in `docs/RESEARCH.md`.

1. What `referencePrice` in `/rwa/price` actually is: a real market quote, or derived from the on-chain price.
2. Whether bStocks token prices are quoted per raw unit or per UI unit (BEP-677), and how to get each venue's share ratio.
3. Whether all 5 candidate instruments exist on BSC for all three issuers.
4. Whether `baw auth signin` works from Nigeria (issues #266 and #274).
5. Whether `baw market-order swap` handles bStocks and Ondo directly, or RFQ must be done by hand.
6. APRO feed addresses on BSC and their interface (Chainlink-style `latestRoundData`?).
7. Whether a public endpoint exists for the Binance bStocks collateral index.

## Key docs

- Hackathon: https://www.bnbchain.org/en/hackathons/tokenized-stocks
- Web3 API intro: https://web3.binance.com/en/dev-docs/introduction
- Auth: https://web3.binance.com/en/dev-docs/authentication
- Trading API: https://web3.binance.com/en/dev-docs/products/trading-api/introduction
- Trading error codes: https://web3.binance.com/en/dev-docs/products/trading-api/error-codes
- Agentic Wallet: https://developers.binance.com/docs/agentic-wallet/welcome
- Agentic Wallet skill source: https://github.com/binance/binance-skills-hub/tree/main/skills/binance-web3/binance-agentic-wallet
- Agent Studio: https://docs.bnbchain.org/developer-kit/bnbchain-studio/
- BEP-677: https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md
- APRO price feeds: https://docs.apro.com/en/data-push/price-feed-contract
