# Demo storyboard (T6 draft)

A 4:00 cut, adapted from SPEC section 10 to what exists and what we have learned. Bracketed items are open: they depend on data or on work not done yet. Narration notes are placeholders for the person recording; say them in your own words.

**Recording slots.** The segment at 2:15 needs the US open: Mon 5 Oct 13:30 UTC (14:30 Lagos), with backup footage on Mon 28 Sep. Re-scan the `baw` QR before either, since the session ends after 48 h idle or 7 days.

| Time | Beat | On screen | Status |
|---|---|---|---|
| 0:00 | Saturday. Nasdaq closed hours ago. An agent wants $1,000 of NVIDIA. Which NVIDIA? | Three tokens side by side: NVDAB, NVDAon, NVDAx, with their raw prices (not comparable) | Ready: web terminal instrument page |
| 0:25 | The official Agentic Wallet skill asks the user to pick an issuer for a bare ticker. OneTicker resolves it. | Claude Code: "buy $500 of nvidia" → `resolve_instrument` → `quote_route`, no question asked (`docs/skill-demo.md`) | Ready: record live |
| 0:50 | Compare per share, not per token. xStocks are excluded, with the reason in plain English. | Ranked routes in SEP; NVDAx "no liquidity from any vendor right now (40374)" | Ready |
| 1:20 | The gate: the reference is N hours old; the on-chain pool trades X bps above Binance's index; the 24/7 perp says Y. Verdict with reasons. | Route panel verdict; pool vs index vs perp from the Tape | [needs weekend-1 data for real numbers] |
| 1:50 | Verdicts are code, not opinions. Same input, same verdict: `check_gate` replays it from the `routeId`. | `quote_route` then `check_gate`, `inputHashMatches: true` | Ready |
| 2:15 | Agent to agent: a paid quote over x402, then a Wait-for-GO intent. Cut to Monday's open: the verdict turns GO and the trade executes through the Agentic Wallet, tx on BscScan. | Agent Studio call; intent; `execute_route` preview then confirm; BscScan | [T10 x402, T12 intents, T9 funded trade] Fallback: the gate changing verdict at the open and a manual `execute_route` |
| 3:15 | The Tape: one chart, one finding from two weekends. | `/tape` chart | [T15, after 5 Oct] |
| 3:50 | "One ticker in. The safest fill out." | Repo link, MCP install line, skill install line | Ready |

## Candidate findings for the 3:15 slot

To be decided by the data, whatever it says. Current leads, each verified once and not yet over a weekend:

- On-chain pools vs Binance's index off-hours: 10 to 50 bps above it on 22 Sep evening, 2 to 16 bps below it on 23 Sep early morning.
- Whether the collateral index freezes over the weekend (it did not on a weekday evening, contrary to the FAQ).
- Whether the TradFi perps trade through the weekend, and how well Sunday-night perp and pool prices predict Monday's open.
