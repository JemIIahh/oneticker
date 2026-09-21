# DX evidence log

Append-only. Newest entries at the bottom. Facts, not opinions. This is the raw material for `REPORT.md`, which humans write at the end.

## Entry format

```
### 2026-09-21 14:05 UTC · <who> · <surface: Web3 API / Agentic Wallet / Agent Studio / docs / oracle / other>
- Did: <exact command, request, or URL>
- Expected: <what the docs or common sense said would happen>
- Actual: <paste the output or error, verbatim>
- Time lost: <minutes>
- Severity: blocker | slowed us | annoyance
- Suggestion: <one line, optional>
```

## Hypotheses to reproduce

These came from desk research, not from our own use. **None of them go in the report until we reproduce them ourselves** and log an entry above with our own evidence. Tick each when reproduced or disproved.

- [ ] `/build` prefix required in the signed path; omitting it gives 40102.
- [ ] `referencePrice` in `/rwa/price` is derived from the on-chain price, not a real market quote.
- [ ] No official SDK for Market, Trading, Transaction or DeFi modules; `@binance-web3/wallet` has no code examples.
- [ ] Web3 API docs render client-side and return an empty page to non-browser fetchers.
- [ ] The only official Binance MCP server is CEX-only; nothing covers Web3 / RWA.
- [ ] `binance-tokenized-securities-info` skill covers Ondo only (no bStocks, no xStocks), and its `volume24h` is US stock volume, not on-chain volume.
- [ ] The Agentic Wallet skill resolves bStocks through an undocumented `www.binance.com/bapi/...` endpoint.
- [ ] No canonical resolver for the same ticker across issuers; the skill tells the agent to ask the user.
- [ ] `baw auth signin` fails with `SERVICE_ERROR: {body.location=must not be blank}` (issues #266, #274).
- [ ] The skill still routes bStock trades through `references/campaign.md` for a competition that ended 1 Sep 2026.
- [ ] Node version: 18+ in the Agentic Wallet quickstart vs 22+ in the skills hub README.
- [ ] Agentic Wallet supported chains differ between the dev-docs page and the skills listing.
- [ ] Agent Studio trial length: 48h (docs) vs "72-24 hours" (hackathon page) vs "up to 48 hours" (launch blog).
- [ ] Agent Studio language: TypeScript (docs) vs Python (launch blog).
- [ ] `contract-call --value` is in wei while `--amount` elsewhere is in token units.
- [ ] CEX tokenized-stock API and Web3 RWA API are documented separately with no cross-links.
- [ ] Error 40369: bStocks RFQ unavailable outside exchange hours, while the token keeps trading on PancakeSwap.
- [ ] APRO tokenized-equity feeds: 1h heartbeat, 1% deviation.

---

## Entries
