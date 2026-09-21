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
- [x] Web3 API docs render client-side and return an empty page to non-browser fetchers. **Reproduced 21 Sep 22:16** (entry above): the cause is an AWS WAF challenge (`HTTP 202`, empty body, `x-amzn-waf-action: challenge`), not only client-side rendering.
- [ ] The only official Binance MCP server is CEX-only; nothing covers Web3 / RWA.
- [ ] `binance-tokenized-securities-info` skill covers Ondo only (no bStocks, no xStocks), and its `volume24h` is US stock volume, not on-chain volume.
- [ ] The Agentic Wallet skill resolves bStocks through an undocumented `www.binance.com/bapi/...` endpoint.
- [ ] No canonical resolver for the same ticker across issuers; the skill tells the agent to ask the user.
- [ ] `baw auth signin` fails with `SERVICE_ERROR: {body.location=must not be blank}` (issues #266, #274).
- [ ] The skill still routes bStock trades through `references/campaign.md` for a competition that ended 1 Sep 2026.
- [ ] Node version: 18+ in the Agentic Wallet quickstart vs 22+ in the skills hub README. (21 Sep: npm `engines` for `@binance/agentic-wallet` 1.10.0 is `>=18.0.0`; the two docs pages still to compare in a browser.)
- [ ] Agentic Wallet supported chains differ between the dev-docs page and the skills listing.
- [ ] Agent Studio trial length: 48h (docs) vs "72-24 hours" (hackathon page) vs "up to 48 hours" (launch blog).
- [ ] Agent Studio language: TypeScript (docs) vs Python (launch blog).
- [ ] `contract-call --value` is in wei while `--amount` elsewhere is in token units.
- [ ] CEX tokenized-stock API and Web3 RWA API are documented separately with no cross-links.
- [ ] Error 40369: bStocks RFQ unavailable outside exchange hours, while the token keeps trading on PancakeSwap.
- [ ] APRO tokenized-equity feeds: 1h heartbeat, 1% deviation.
- [ ] Response envelope field names: our notes say `{ code, message, data, timestamp, success }`; the official JS connector parses `{ code, msg, data, timestamp }` and returns `data` without checking `code` (`common/src/utils.ts`, `httpRequestFunction`). **Error shape reproduced 21 Sep 15:35** (entry below): `msg`, numeric `code`, no `success`. Success shape still to check.
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

### 2026-09-21 15:35 UTC · claude (Railway sfo) · Web3 API
- Did: unsigned `GET https://web3.binance.com/build/api/v1/dex/market/rwa/platforms` from Railway region `sfo` (`pnpm reach`). Fixture: `fixtures/web3/rwa-platforms-unsigned-20260921T153507Z.json`
- Expected: envelope `{ code, message, data, timestamp, success }` (our research notes)
- Actual: HTTP 401 in 362 ms, body `{"msg":"API Key is required","data":"","code":40101,"timestamp":1790004907808}`. Field is `msg`, not `message`; no `success` field; `data` is an empty string, not null. Headers include `x-oc-blocked-by: AuthenticationFilter/40101`, `x-oc-trace-id: unknown-gateway-50916a73c0ba4561aa22dea74d037771`, `x-cache: Error from cloudfront`.
- Time lost: 0
- Severity: annoyance
- Suggestion:

### 2026-09-21 22:16 UTC · claude (dev laptop, Lagos, over VPN) · Web3 API / docs
- Did: `pnpm reach` (unsigned `GET /build/api/v1/dex/market/rwa/platforms`) and `curl -D - https://web3.binance.com/en/dev-docs/authentication`, with the user's VPN on
- Expected: API and docs reachable, as they are from Railway
- Actual: API: HTTP 401 `40101 API Key is required` in 2,922 ms, CloudFront POP `LHR95-P3` (Railway `sfo`: 362 ms). Docs: `HTTP/2 202`, `content-length: 0`, `x-amzn-waf-action: challenge`. The docs page returns an empty body to a non-browser client because of an AWS WAF challenge.
- Time lost: 0
- Severity: slowed us
- Suggestion:

### 2026-09-21 22:53 UTC · claude (dev laptop, VPN on) · Agentic Wallet
- Did: `npm i -g @binance/agentic-wallet`, `baw --version`, `baw auth signin --help`, `gh issue view 266` and `274 -R binance/binance-skills-hub`
- Expected: install and help work; sign-in issues resolved or with a workaround
- Actual: `added 74 packages in 12s`, `baw` `1.10.0` (npm modified `2026-09-09T09:05:59.068Z`). Package `engines`: `{ node: '>=18.0.0' }`. Sign-in is a QR flow: `baw auth signin [--image] [--json]`, then `baw auth verify --qrCodeId <id>`. Issues #266 "baw auth signin --json fails with SERVICE_ERROR: body.location must not be blank" and #274 "baw auth signin fails with SERVICE_ERROR: {body.location=must not be blank}" are both `OPEN`, last updated `2026-05-25` and `2026-06-09`.
- Time lost: 0
- Severity: annoyance
- Suggestion:
