# Security

OneTicker routes and checks tokenized-stock trades. It holds no funds and no keys of its own. This page says what it can touch, what stops it doing damage, and what is not done.

## What it can touch

| Surface | Can it move money? |
|---|---|
| CLI, MCP read tools (`resolve_instrument`, `get_market_state`, `get_price_surfaces`, `quote_route`, `check_gate`), web terminal, the Tape | **No.** They read prices and quotes. No signing code runs in them. |
| `execute_route` | Only in the **local stdio MCP server**, and only through the user's own Binance Agentic Wallet (`baw`), which holds the keys and enforces its own limits. It is not exposed over HTTP or on any public agent. |

## What stops a bad trade

- **Preview, then confirm.** `execute_route` returns a preview first and trades only on a second call with `confirm: true`, within 60 seconds, once per preview.
- **Mainnet cap of $25 per trade** (`EXEC_MAX_USD_PER_TRADE`) from a dedicated hot wallet, unless a human raises it.
- **`EXEC_MODE=preview` by default.** Nothing is sent unless `EXEC_MODE=agentic-wallet`. No trade has been sent to date.
- **Gate refusals.** BLOCK is never executed. CAUTION needs the user to accept the reasons. A quote older than 60 seconds is refused. The wallet's own quote may not be more than 50 bps worse per share than the routed price. A pending order is never reported as filled.
- **The gate is deterministic code**, thresholds in [`packages/core/policy/default.json`](packages/core/policy/default.json). An LLM may explain a verdict, never set one. `check_gate` replays any verdict from its `routeId`.
- **Wallet side.** The Agentic Wallet has its own daily limit and token allow-list; its session ends after 48 hours.

## Secrets

- `.env`, keys, keystores and `baw` session files are gitignored and excluded from the Docker build context. Every commit is checked for them before it is pushed.
- The Tape's container receives only the eight variables it reads (`docker-compose.yml`). Signing keys are never passed to it.
- The Binance Web3 API key is used server-side by the Tape and the local MCP server. It is not in any web bundle (checked on the production build output).
- Any key that was ever exposed is rotated before submission.

## What is not done

- No third-party audit. The code is small and mostly pure functions with tests (`pnpm -r test`), but it has not been reviewed by anyone outside the team.
- The gate's thresholds are starting guesses. The first weekend of data never tested them (`docs/tape-findings.md`).
- The gate has no independent equity price yet. Its reference is Binance's own derived price, so a premium against it is only as good as that price.
- No funded mainnet trade has been made, so the RFQ and AMM execution paths are untested with money.

## Reporting a problem

Open a GitHub issue on this repository. Do not post keys, wallet files or session tokens in it.
