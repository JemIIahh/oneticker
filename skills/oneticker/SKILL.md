---
name: oneticker
description: |
  Use before any buy, sell, swap or quote of a tokenized US stock on BNB Chain: a ticker or company name
  (NVDA, nvidia, TSLA, Tesla, QQQ, Nasdaq 100, CRCL, Circle, MSTR, Strategy / MicroStrategy), or an issuer
  token (NVDAB, NVDAon, NVDAx and the like: bStocks "B", Ondo "on", xStocks "x"). Resolves a bare ticker to the
  best issuer instead of asking the user which one, compares issuers per underlying share, and runs a
  deterministic GO / CAUTION / BLOCK safety gate that matters most when the US market is closed.
  Works alongside binance-agentic-wallet, which still places the trade.
metadata:
  author: oneticker
  version: '0.1.0'
  requires:
    mcp: oneticker
    skills:
      - binance-agentic-wallet
---

# OneTicker: tokenized stocks on BNB Chain

The same stock trades on BNB Chain as up to three tokens: bStocks (`NVDAB`), Ondo (`NVDAon`) and xStocks (`NVDAx`). Their prices are not comparable at face value (each token represents a different number of shares), and for most of the week the US market is closed, so nothing checks the token price against the real stock.

This skill makes the `oneticker` MCP server the step between "the user wants a stock" and `baw market-order swap`. OneTicker picks the venue and says whether it is safe right now. `binance-agentic-wallet` still does everything wallet-related: sign-in, balances, the token audit, confirmation and the swap itself. Follow that skill's rules as well; this one adds to them, it does not replace any.

**Coverage:** NVDA, TSLA, QQQ, CRCL, MSTR on BSC (`binanceChainId` `56`). For any other stock, say OneTicker does not cover it and follow `binance-agentic-wallet` as written.

## Requirements

The `oneticker` MCP server must be connected. Its tools: `resolve_instrument`, `get_market_state`, `get_price_surfaces`, `quote_route`, `check_gate`. If they are not available, tell the user that OneTicker is not connected and fall back to `binance-agentic-wallet`'s own rule for bare tickers (ask which provider). Never pick an issuer yourself without OneTicker.

## Rules

1. **Never ask which issuer for a bare ticker.** "Buy some nvidia" means the instrument, not a token: call `resolve_instrument`, then `quote_route`, and take the best route. This overrides `binance-agentic-wallet`'s "ask the user which provider" rule for the five covered instruments only.
2. **Respect an explicit token.** If the user names one (`NVDAon`, "the Ondo one", a contract address), `resolve_instrument` returns it as `requestedVenue`. Trade that venue, but still run `quote_route` and apply its verdict. If another venue is meaningfully cheaper, say so once, then do what the user asked.
3. **The gate decides; you explain.** Verdicts come from deterministic code. Never soften, upgrade or reinterpret one, and never invent reasons it did not give.
4. **Compare per share only.** Every price from OneTicker is a share-equivalent price (SEP): USD per one underlying share. Never compare raw token prices across issuers.
5. **Addresses come from tools.** Use the `address` on the chosen route (or from `resolve_instrument`) as `--toToken` / `--fromToken`. Always show it in full next to the symbol.
6. **No fallback trading.** If every venue is excluded, report the reasons. Do not look up another token for the same stock some other way and trade that instead.

## Buy flow

1. **Resolve.** `resolve_instrument` with the user's words. No match: the stock is not covered; see Coverage above.
2. **Quote.** `quote_route` with `instrument`, `side: "buy"` and `amountUsd` (the user's amount in USD; ask only if they gave none). The result has:
   - `routes`: venues that can fill, best first, each with `sep`, `sharesPerToken`, `address`, `premiumBps` and a `gate` verdict with `reasons`.
   - `excluded`: venues that cannot fill right now, each with a plain-English `reason` and the API `code`.
   - `marketState`, `referenceAgeSec` and `routeId`.
3. **Act on the best route's verdict:**

   | Verdict | Do this |
   |---|---|
   | `GO` | Continue to step 4. |
   | `CAUTION` | Show every reason in plain English. Ask the user whether to proceed **given those reasons**. A general "yes" to the trade given before they saw the reasons does not count. |
   | `BLOCK` | Do not trade, whatever the user says. Explain every reason. Then call `get_market_state` and offer to re-quote after `nextOpen` (give it in UTC and the user's time zone if known), or a smaller amount if a reason is `IMPACT_HIGH`. |

   If the best route is `BLOCK` but a lower-ranked route is `GO` or `CAUTION`, you may offer that route instead, stating how much more it costs per share.
4. **Hand over to `binance-agentic-wallet`.** Run its swap security pre-check (token audit) on the route's `address`, then get a `baw` quote:

   ```bash
   baw market-order quote --fromTokenQty <amountUsd> --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken <route.address> --binanceChainId 56 --json
   ```

   (USDT is shown; use whichever stablecoin that skill picks.)
5. **Cross-check.** Convert the `baw` quote to per share: `(fromCoinAmount / toCoinAmount) / sharesPerToken`. If it is more than 50 bps worse than the route's `sep`, the price has moved: go back to step 2 and do not swap on the old verdict.
6. **Confirm and swap.** Present the route, the verdict and the `baw` quote together, and get confirmation as `binance-agentic-wallet` requires. If more than 60 seconds have passed since `quote_route`, call `check_gate` with the `routeId`. If it warns the quote is stale, go back to step 2 first. Then run `baw market-order swap` and poll to a terminal state exactly as that skill says.

## Sell flow

The user can only sell the token they hold, so there is no venue choice; the gate still applies.

1. Find the holding with `baw wallet balance --json` and resolve its symbol or address with `resolve_instrument`.
2. Get its USD value with `baw market-order quote` (token → USDT), then call `quote_route` with `side: "sell"` and that `amountUsd`. Use the route whose `symbol` matches the holding.
3. Apply the verdict table above: on a sell, `PREMIUM_HIGH` means receiving less than the last reference price. If the held venue is excluded, report its reason and stop.
4. Swap and poll via `binance-agentic-wallet`.

## Explaining reasons

Each reason has a `code` and a `detail` sentence. Use the detail, and add context from this table:

| Code | What it means for the user |
|---|---|
| `REF_STALE` | The US market is closed; the last real stock price is this old. The token can drift from where the stock will open. |
| `REF_MISSING` | No independent stock price to compare against. The trade is not checked against the real market. |
| `PREMIUM_HIGH` | Buying above (or selling below) the last reference price by this much. |
| `ORACLE_STALE` | The on-chain price oracle has not updated for longer than its heartbeat. |
| `ORACLE_DIVERGENCE` | The executable price is far from the oracle's price. |
| `IMPACT_HIGH` | The order is large for current liquidity; a smaller order costs less per share. |
| `MULTIPLIER_PENDING` | A dividend or split adjustment is scheduled; balances and prices will rescale. |
| `VENUE_HALTED` | The issuer paused this token. |

If `quote_route` includes a `referenceNote`, pass it on: it means the reference price is not independent, so the premium is only a partial check.

For exclusions, give the `reason` as returned, with the `code` in brackets, for example "no liquidity from any vendor right now (40374)". Do not guess at causes the reason does not state.

## Example

User: "buy $300 of tesla"

1. `resolve_instrument {"query": "tesla"}` → `US:TSLA`: TSLAB, TSLAon, TSLAx.
2. `quote_route {"instrument": "US:TSLA", "side": "buy", "amountUsd": 300}` → best TSLAB, `CAUTION` (`REF_STALE`: reference 14h 12m old, market closed for the weekend); TSLAx excluded (40374).
3. Tell the user: TSLAB (`0x…` in full) is the cheapest per share, $X versus $Y on TSLAon. It's the weekend, so the last real Tesla price is 14 hours old and the token may not match Monday's open. Proceed anyway, or re-quote after the open on Monday at 13:30 UTC?
4. Only on a clear yes to that: audit, `baw` quote, cross-check, confirm, swap, poll.
