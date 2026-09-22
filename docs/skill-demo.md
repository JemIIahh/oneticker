# Wallet Skill demo transcripts (T11)

Recorded 22 Sep 2026, about 22:40 UTC (US market in post-market, reference 2h 40m old). Headless Claude Code (`claude -p`) in an empty scratch folder, so this repo's `CLAUDE.md` could not coach it. The session had only:

- `.claude/skills/oneticker` (this repo's `skills/oneticker/SKILL.md`)
- `.claude/skills/binance-agentic-wallet` (official, binance-skills-hub `9960c67`, 11 Sep 2026, skill v1.12.0)
- the `oneticker` MCP server (`apps/mcp`, stdio)
- read-only `baw` commands allowed; `baw market-order swap`, `limit-order` and `wallet send` explicitly denied. The agent wallet holds no funds.

Tool calls are listed in order; the final answer is verbatim.

## Run 1: bare company name, small buy

> I want to buy $20 of nvidia with USDT from my agentic wallet.

Tool calls:

1. `Skill oneticker`
1. `Skill binance-agentic-wallet`
1. `Bash (reads the binance-agentic-wallet reference files)`
1. `oneticker/resolve_instrument {"query": "nvidia"}`
1. `oneticker/quote_route {"instrument": "NVDA", "side": "buy", "amountUsd": 20}`
1. `Bash (reads the binance-agentic-wallet reference files)`
1. `Bash (reads the binance-agentic-wallet reference files)`
1. `Bash baw skill-check --skill-name binance-agentic-wallet --current-version 1.12.0 --json; echo; baw cli-check --required-version 1.10.0 --json; echo; baw wallet status --json; echo; baw wallet settings --json; echo; baw wallet balance --json`
1. `Bash baw wallet address --json`

13 turns.

Final answer:

> I can't place this trade yet because **your Agentic Wallet is empty.** `baw wallet balance` returned no tokens on any chain, so there's no USDT to pay with.
>
> **To fund it,** send at least 20 USDT on **BNB Smart Chain (BSC)** to your wallet address:
> `0xE698f6062675D942B51622464635C2286FAD0798`
> - USDT (BSC) contract: `0x55d398326f99059fF775485246999027B3197955`
> - A little BNB for gas is also useful.
>
> The wallet is signed in, and the session lasts until 2026-09-24 23:41 (UTC+1).
>
> **Route I'd use:** OneTicker compared all three NVIDIA tokens on BNB Chain. Prices below are per NVIDIA share.
>
> | Token | Contract | Price per share | Above reference | Verdict |
> |---|---|---|---|---|
> | **NVDAon** (Ondo), best | `0xa9ee28c80f960b889dfbd1902055218cba016f75` | $228.18 | 0.04% | CAUTION |
> | NVDAB (bStocks) | `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` | $228.29 | 0.09% | CAUTION |
> | NVDAx (xStocks) | `0xc845b2894dbddd03858fd2d643b4ef725fe0849d` | — | — | Can't be bought: no liquidity from any vendor right now (40374) |
>
> **The verdict is CAUTION, for this reason:**
> - **The reference price is 2h 40m old.** The US market is in after-hours trading, so the last real NVIDIA price is 2h 40m old, and the token can drift from where the stock trades at the next open.
> - **The reference isn't independent.** It comes from Binance's own figure, which is based on the token's own price. That means the 0.04% premium is only a partial check against the real stock price.
>
> **Next:** fund the wallet, then tell me whether you want to go ahead **given those reasons**. I'll then re-quote, since this quote will be stale by then. After that I'll run the token security audit on NVDAon, get a live wallet quote, and check it against the price above. You'll get one last confirmation before anything is swapped. Slippage defaults to "auto" unless you give a limit. Please do your own research; this isn't investment advice.

## Run 2: bare ticker, large buy

> Buy $50,000 of TSLA for me.

Tool calls:

1. `Skill oneticker`
1. `oneticker/resolve_instrument {"query": "TSLA"}`
1. `oneticker/quote_route {"instrument": "TSLA", "side": "buy", "amountUsd": 50000}`

6 turns.

Final answer:

> I haven't placed the trade yet. OneTicker's safety check came back **CAUTION**, and you need to see why before deciding.
>
> **Best route: TSLAon (Ondo)** `0x2494b603319d4d9f9715c9f4496d9e0364b59d93`
>
> | Token | Price per Tesla share | vs. last reference price | Safety check |
> |---|---|---|---|
> | **TSLAon** (Ondo) | **$378.43** | 0.08% below | CAUTION |
> | TSLAB (bStocks) | $378.86 | 0.03% above | CAUTION |
> | TSLAx (xStocks) | — | — | Unavailable: no liquidity from any vendor right now (40374) |
>
> $50,000 buys about 132.1 Tesla shares' worth of TSLAon. That's about $57 cheaper in total than buying TSLAB.
>
> **Why it's CAUTION:**
> - **The last real Tesla price is 2h 41m old.** The US regular session has ended and it's after-hours now. The token trades on-chain without anything checking it against the real stock, so it can drift from where Tesla opens.
> - **The price check isn't independent.** OneTicker compared the token against Binance's reference price, and that price is calculated from the token's own price. So "0.08% below reference" doesn't prove you're paying a fair price for Tesla.
>
> At $50,000, either of these is worth taking seriously.
>
> **Your options:**
> 1. **Go ahead now** with TSLAon at about $378.43 per share, knowing the two risks above.
> 2. **Wait for the regular session.** It opens tomorrow, Sep 23, at 13:30 UTC (9:30 ET). I'd re-quote then, with a live Tesla price to check against.
>
> If you go ahead, I'll next run a security check on the token and get a live quote from your Binance wallet. Then I'll show you the final numbers for one more confirmation before anything is swapped. Which option do you want?

## What this shows

- **Bare ticker resolution:** neither run asked which issuer. `binance-agentic-wallet` alone says to ask the user for a bare ticker (its SKILL.md, "Bare ticker with no suffix").
- **Per-share comparison across issuers,** with full contract addresses and plain-English exclusions (xStocks 40374 in both runs).
- **CAUTION handled as the skill says:** reasons shown, and consent asked for *given those reasons*; the derived-reference caveat passed on.
- **The official skill still governs the wallet:** run 1 did its preflight (`skill-check`, `cli-check`, `wallet status`, `settings`, `balance`) and stopped at the empty wallet; both runs queued the token audit and a `baw` quote cross-check before any swap.
- **Venue choice depends on size:** NVDAon was cheapest at $20 here, NVDAB at $500 in the Claude Code check at 22:35 UTC.

## Not yet shown

- **BLOCK leading to an offer to wait.** No live BLOCK occurred: at $50,000, TSLA quotes from LiquidMesh showed no price impact, so only `REF_STALE` (CAUTION) fired. To record when a real BLOCK happens (most likely a weekend premium over 200 bps).
- A funded end-to-end swap (T9).
