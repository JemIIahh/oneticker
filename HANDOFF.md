# Session handoff

Written 22 Sep 2026, ~22:15 UTC, end of day 2 of the hackathon (deadline Sun 11 Oct 12:00 UTC). The user is restarting their Claude Code session; this is what the next one needs to pick up cleanly. Read `CLAUDE.md` first (repo rules), then this file, then `PLAN.md` for ticket-by-ticket detail.

## In one paragraph

The core library, the price recorder (the Tape), the safety gate, a CLI, and a first pass at the web terminal are all built and tested (92 tests, clean build, working tree clean, all pushed to `main`). The one real blocker: **Binance's Web3 API refuses every request from our hosting** with an undocumented `40304 "compliance restriction"` error — reproduced from three Railway regions (US, Singapore, Netherlands) and from a Netherlands VPN on the laptop. Only a French exit has worked so far. The fix in progress is moving the Tape from Railway to Fly.io's Paris region; the Dockerfile and `fly.toml` are written and committed, but nothing is deployed there yet because the user hasn't created a Fly.io account.

## Do this first

1. **Check whether the user has done any of the pending items below** (see "Waiting on the user"). If yes, act on it before anything else — most of them unblock real work.
2. **If Fly.io is set up** (`fly auth whoami` succeeds): deploy the Tape there. Files are ready at `apps/tape/Dockerfile` and `apps/tape/fly.toml` (app name `oneticker-tape`, region `cdg`). Rough plan: `fly launch --no-deploy` won't work cleanly with an existing `fly.toml` — instead `cd apps/tape && fly apps create oneticker-tape --org personal` (or whatever org exists), `fly volumes create tape_data --region cdg --size 1 -a oneticker-tape`, then `fly deploy --config fly.toml --dockerfile Dockerfile -a oneticker-tape` from the **repo root** (the Dockerfile's COPY paths assume that build context). Set secrets with `fly secrets set BINANCE_WEB3_API_KEY=... BINANCE_WEB3_API_SECRET=... TAPE_QUOTE_WALLET=0xE698f6062675D942B51622464635C2286FAD0798 -a oneticker-tape` (get the key values from the user's local `.env`, never print them). Verify with `curl https://oneticker-tape.fly.dev/health` and `/api/latest` showing non-null `exec_px_100`. Once confirmed working, update `TAPE_API_URL` in `.env`, `.env.example`, and on Vercel (once that's linked) to the Fly URL, and consider stopping/deleting the Railway `tape` service (or leave it as a chain-only fallback — your call, but say which you did).
3. **If Fly.io isn't set up yet**: don't block on it. Move to whatever else is unblocked — see "What's next regardless" below.

## Waiting on the user (nothing else proceeds past these without them)

| # | What | Why it matters | How |
|---|---|---|---|
| 1 | **Fly.io account + `fly auth login`** | Tape is stuck recording only chain data (oracle, multiplier) until it runs from an allowed country | fly.io signup (needs a card even for free tier), then `! fly auth login` in chat |
| 2 | **Finnhub API key** | Binance's own "reference price" is derived from the token price, not real (confirmed 22 Sep) — Finnhub is the only path to a real comparison price, needed for the gate's premium/reference checks to mean anything | finnhub.io signup, key into `.env` as `FINNHUB_API_KEY` (already has an empty line waiting) |
| 3 | **Vercel Root Directory** | `apps/web` isn't deployed; `oneticker` Vercel project exists but was never told the app lives in a subfolder | vercel.com → project `oneticker` → Settings → General → Root Directory → `apps/web` → Save, then Settings → Git → connect `JemIIahh/oneticker` `main`. (I tried `vercel link --repo` once; it failed with "No Projects are linked" — dashboard is more reliable here.) |
| 4 | **Wallet daily limit** | `baw wallet settings` shows `dailyLimit: 50000`; should be ~$100 given our $25/trade cap | Binance app, agent wallet settings |
| 5 | **Stopwatch note from getting the API keys** | T0's one-time DX measurement, still blank in `dx/LOG.md` (the entry at 11:28 UTC has "user to fill in" placeholders) | Ask the user for the total time and any portal friction, then fill in that entry |
| 6 | **Hackathon application form + builder Telegram** | T0 checklist item, unticked | User-only, no code involved |
| 7 | *(lower priority)* Hot wallet funding (~$100 USDT/USDC + BNB for gas) | Needed for T9 (execution), not urgent yet | Only after explicit go-ahead — see safety rules below |

Don't re-ask about things already declined or deferred; just check current state (e.g. `fly auth whoami`, `railway variables --kv`, `ls apps/web/.vercel`) before assuming nothing changed.

## What's next regardless (no user action needed)

In rough priority order, picking up from `PLAN.md`:

- **T4 remainder**: SEP normalization sanity check ("during market hours, NVDA SEP across all venues lands within a sane band of the reference") — needs live Binance data, so it's semi-blocked by the Fly.io move. The collateral-index surface (unverified item 7) can be researched independently (open question: does a public endpoint exist?).
- **T5 remainder**: run `pnpm oneticker quote <TICKER> buy <amount>` during real US market hours (13:30–20:00 UTC weekdays) once live data works, and save the output — this is explicit acceptance criteria, not yet done (today's test run had no network).
- **T8 (MCP server)**: not started. `apps/mcp` is still a placeholder (`export {}`). The router logic in `packages/core/src/router/quote.ts` and the gate in `packages/core/src/gate` are already the right shape to wrap as MCP tools (`resolve_instrument`, `get_market_state`, `get_price_surfaces`, `quote_route`, `check_gate`) — this is genuinely unblocked and worth starting even before Fly.io lands, using fixture/Tape data the same way the CLI does.
- **T6 remainder**: `/tape` page is still a placeholder text block (no chart yet, correctly — there's no weekend data yet). README draft/storyboard not started.
- **Website polish**: user asked for a redesign twice already (first pass: green terminal; user disliked it; second pass: adopted the design system from `~/code/stow` — cream/ink/graphite, Schibsted Grotesk + JetBrains Mono). User has NOT yet confirmed the second design or the adjusted 3D ring is good — I made ring-size/camera tweaks based on a stock-page screenshot (not home-page), never got a follow-up screenshot to confirm they landed. **Ask for a fresh home-page screenshot before doing more visual work**, don't keep guessing blind.
- **DX report**: keep logging findings as they happen (`dx/LOG.md`); do not write `dx/REPORT.md` prose — that's the team's job, explicitly forbidden in `CLAUDE.md`.

## Key facts a new session needs (don't rediscover these)

- **The 40304 compliance block** is the single biggest open problem. Confirmed from Railway sfo/Singapore/Amsterdam and a Netherlands VPN; NOT reproduced from a French VPN exit or (implicitly) wherever the user's Agentic Wallet sign-in succeeded. No country list is published. Fly.io Paris (`cdg`) is the planned fix; Frankfurt is an untested backup if Paris also gets blocked (worth trying since a Germany VPN attempt was interrupted mid-test and never confirmed).
- **Binance's `referencePrice` is derived**, not a real market quote — confirmed by comparing to `tokenToShareRatio` across all 15 tokens (22 Sep, `dx/LOG.md`). Every "reference" in the app right now (CLI, web fallback) is labeled as such. Finnhub is the real fix, pending the user's key.
- **The registry** (`packages/core/src/registry/instruments.json`) is final for now: NVDA, TSLA, QQQ, CRCL, MSTR — team decided MSTR as the 5th ticker (tracks Bitcoin, trades all weekend). Rebuildable via `pnpm registry` from `fixtures/bapi/*`, which itself is verified on-chain.
- **MSTRB has no APRO oracle feed** — confirmed, handled everywhere (CLI, Tape, gate all treat a missing oracle as "not applicable", never an error).
- **xStocks (the third venue) barely trades** on BSC — all 5 xStocks tokens returned `40374 No liquidity` for a $100 quote on 22 Sep, with on-chain prices 6h to 14 days stale. This is a real finding, already in `docs/RESEARCH.md` and `dx/LOG.md`; expect it to keep showing as excluded most of the time, and don't treat that as a bug.
- **Agentic Wallet (`baw`) is signed in**, connected, empty (no funds moved, nothing to lose). Session expires after 48h idle / 7 days max — will need a re-scan before the 5 Oct demo recording. `market-order quote` works for bStocks/Ondo directly (no manual RFQ needed for quotes). Swap **execution** is untested — that's T9, not started.
- **The wallet address** used for `TAPE_QUOTE_WALLET` and RFQ quotes is `0xE698f6062675D942B51622464635C2286FAD0798` — public, fine to use, never treat as secret.
- **Vercel and Fly.io CLIs are both installed** (`vercel`, `fly`/`flyctl`) but neither is authenticated for this project's deploy target yet (Vercel is logged in as a user but the project isn't linked; Fly.io has no access token at all).
- **Railway auto-deploy on push has never worked** all session — every deploy so far was triggered manually via `connect-service-source` (MCP) or `railway up`. If moving off Railway entirely, this stops mattering; if keeping any service there, keep triggering deploys manually or debug why the GitHub webhook isn't firing (Settings → Git on the Railway dashboard is unexplored).
- **`pnpm build` and `pnpm test` are the sanity check** — run them after any change, before committing. As of this handoff: 92 tests passing (`core` 56, `clients` 16, `tape` 20), clean typecheck across the whole workspace including `apps/web` and `scripts/`.

## Safety rules, reiterated (from `CLAUDE.md`, don't relax these)

- `EXEC_MODE=preview` in `.env` — no trades have been sent, none should be without the user explicitly asking, even after funding.
- Never commit `.env`, keys, or wallet files. Every commit this session was checked for this before pushing (`git diff --cached --name-only | grep -Ei '\.env$|\.key$|...'`) — keep doing that.
- $25/trade cap, dedicated hot wallet only, `execute_route` (not built yet) must preview-then-confirm.
- The gate is deterministic code, never an LLM judgment — this is already how `packages/core/src/gate` works; keep it that way when building the MCP tool and any future agent surface.

## Where everything lives

- Repo: `/Users/ram/Projects/oneticker`, GitHub `JemIIahh/oneticker`, branch `main`, working tree clean at handoff time.
- Railway: project `oneticker`, service `tape`, public API `https://tape-production-c409.up.railway.app` (see memory `railway-oneticker.md` for IDs).
- Local dev server: was running on `localhost:3456` (`pnpm --filter web dev`) — may have been killed when the session ended; restart if needed.
- Full history, findings, and open questions: `PLAN.md` (tickets), `docs/RESEARCH.md` (API facts, verified/unverified), `dx/LOG.md` (raw friction log, 20 entries), and the two memory files `railway-oneticker.md` / `lagos-network-block.md`.
