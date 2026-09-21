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
- [x] No official SDK for Market, Trading, Transaction or DeFi modules; `@binance-web3/wallet` has no code examples. **Disproved 21 Sep** (see 13:56 entry): the package covers all modules; the Java connector docs have examples.
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
- [ ] Response envelope field names: our notes say `{ code, message, data, timestamp, success }`; the official JS connector parses `{ code, msg, data, timestamp }` and returns `data` without checking `code` (`common/src/utils.ts`, `httpRequestFunction`).
- [ ] recvWindow header name: our notes say `X-OC-RECV-WINDOW`; the official JS connector sends headers literally named `recvWindow` and `nonce`.
- [ ] RWA endpoints cover only `platformId` `ondo` and `bstock` (connector enum); xStocks absent.

---

## Entries

### 2026-09-21 13:50 UTC · claude (dev laptop, Lagos) · Web3 API / docs
- Did: `curl --max-time 40 https://web3.binance.com/en/dev-docs/authentication`, then `curl --max-time 15` to `https://web3.binance.com/build/api/v1/dex/market/rwa/platforms`, `https://www.binance.com`, `https://api.binance.com/api/v3/ping`, `https://developers.binance.com`
- Expected: docs page and API host reachable (HTTP response of any kind)
- Actual: `curl: (28) Connection timed out after 40003 milliseconds` on the docs page. `web3.binance.com` (HTTPS and HTTP) and `www.binance.com`: `http=000`, no response within 15 to 20 s, repeated 3 times. Same network, same minute: `api.binance.com/api/v3/ping` `http=200` in 0.68 s, `developers.binance.com` `http=301` in 1.26 s. `nc -vz 108.156.221.85 443` (a `web3.binance.com` CloudFront IP) succeeds. Cause not established.
- Time lost: 10
- Severity: blocker
- Suggestion:

### 2026-09-21 13:56 UTC · claude · Web3 API / SDK
- Did: read `https://github.com/binance/binance-web3-connector-js/blob/main/clients/web3-wallet/src/rest-api/modules/general-data-api.ts` (`getTokenPrice`, around line 678) and `https://github.com/binance/binance-web3-connector-java/blob/main/clients/web3-wallet/docs/GeneralDataApi.md#getTokenPrice`
- Expected: a way to pass the token list to `POST /api/v1/dex/market/price`
- Actual: JS signature is `getTokenPrice(recvWindow?, nonce?)` and always sends an empty `localVarBodyParameter`. Java: `getTokenPrice().recvWindow(recvWindow).nonce(nonce).execute()`. Description in both: "Supports batch queries, up to 100 tokens per request." Neither shows the request body shape.
- Time lost: 5
- Severity: slowed us
- Suggestion:

### 2026-09-21 13:56 UTC · claude · Web3 API / SDK
- Did: `npm view @binance-web3/wallet name version time.modified`; listed `clients/web3-wallet/src/rest-api/modules/` in `binance/binance-web3-connector-js`
- Expected: package named for the Wallet module only (per our research notes)
- Actual: `@binance-web3/wallet` `12.3.0`, modified `2026-09-18T06:38:11.567Z`, contains modules `rwadata-api`, `trading-api`, `transaction-api`, `general-data-api`, `defi-data-api`, `defi-transaction-api`, `address-portfolio-api`, `b402-payments-api`, `wallet-api`, `web-socket-api`. Repo description: "A simple connector to Binance Web3 Public API".
- Time lost: 0
- Severity: annoyance
- Suggestion:
