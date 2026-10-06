# Demo storyboard (T6 draft)

A 4:00 cut, adapted from SPEC section 10 to what exists and what we have learned. Bracketed items are open: they depend on data or on work not done yet. Narration notes are placeholders for the person recording; say them in your own words.

**Recording slots.** The segment at 2:15 needs the US open: Mon 5 Oct 13:30 UTC (14:30 Lagos), with backup footage on Mon 28 Sep. Re-scan the `baw` QR before either, since the session ends after 48 h idle or 7 days.

| Time | Beat | On screen | Status |
|---|---|---|---|
| 0:00 | Saturday. Nasdaq closed hours ago. An agent wants $1,000 of NVIDIA. Which NVIDIA? | Three tokens side by side: NVDAB, NVDAon, NVDAx, with their raw prices (not comparable) | Ready: web terminal instrument page |
| 0:25 | The official Agentic Wallet skill asks the user to pick an issuer for a bare ticker. OneTicker resolves it. | Claude Code: "buy $500 of nvidia" → `resolve_instrument` → `quote_route`, no question asked (`docs/skill-demo.md`) | Ready: record live |
| 0:50 | Compare per share, not per token. xStocks are excluded, with the reason in plain English. | Ranked routes in SEP; NVDAx "no liquidity from any vendor right now (40374)" | Ready |
| 1:20 | The gate: the reference is N hours old, so the verdict is CAUTION from the clock alone (95% of closed-hour samples). The on-chain pool sits within 36 bps of the 24/7 perp. Verdict with reasons. | Route panel verdict; pool vs perp from `/tape` | Ready: numbers from `docs/tape-findings.md` |
| 1:50 | Verdicts are code, not opinions. Same input, same verdict: `check_gate` replays it from the `routeId`. | `quote_route` then `check_gate`, `inputHashMatches: true` | Ready |
| 2:15 | Cut x402 and intents (6 Oct). Instead: the gate changing verdict at the US open, then `execute_route` preview and confirm through the Agentic Wallet. | Claude Code with the skill; `execute_route` preview then confirm; BscScan if funded | [funded trade needs the wallet funded and `baw` re-scanned] Without funds: show the preview and `not-sent` |
| 3:15 | The Tape: one chart, one finding. In every weekend sample the pool was within 36 bps of the perp; the risk was the issuer (Ondo over 10% above bStocks at $1,000 in 45% of weekend samples). | `/tape` chart and cards | Ready: one weekend, partial coverage, say so on camera |
| 3:50 | "One ticker in. The safest fill out." | Repo link, MCP install line, skill install line | Ready |

## The finding for the 3:15 slot

Decided by the data, from `docs/tape-findings.md` (weekend 2, Fri 2 Oct 20:00 to Mon 5 Oct 13:30 UTC, about half of the possible runs recorded):

- On the weekend the bStocks pool never sat more than 36 bps from the 24/7 perp (100 bps at the open). We saw no weekend premium.
- The gate said CAUTION on nearly every closed hour (95%) from the reference age alone, whatever the prices did.
- The real difference was the issuer: at $1,000, Ondo was more than 10% above bStocks in 45% of weekend samples; xStocks never quoted.

Say plainly that this is one partial weekend. The earlier lead ("pools 10 to 50 bps above the index on 22 Sep evening") was a single evening and is not what the weekend showed.
