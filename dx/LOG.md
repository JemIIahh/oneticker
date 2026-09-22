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
- [x] `referencePrice` in `/rwa/price` is derived from the on-chain price, not a real market quote. **Reproduced 22 Sep 11:30** (entry below): equals `tokenPrice / tokenToShareRatio` for all 15 tokens.
- [x] No official SDK for Market, Trading, Transaction or DeFi modules; `@binance-web3/wallet` has no code examples. **Disproved 21 Sep** (see 13:56 entry): the package covers all modules; the Java connector docs have examples.
- [x] Web3 API docs render client-side and return an empty page to non-browser fetchers. **Reproduced 21 Sep 22:16** (entry above): the cause is an AWS WAF challenge (`HTTP 202`, empty body, `x-amzn-waf-action: challenge`), not only client-side rendering.
- [ ] The only official Binance MCP server is CEX-only; nothing covers Web3 / RWA.
- [ ] `binance-tokenized-securities-info` skill covers Ondo only (no bStocks, no xStocks), and its `volume24h` is US stock volume, not on-chain volume.
- [x] The Agentic Wallet skill resolves bStocks through an undocumented `www.binance.com/bapi/...` endpoint. **Reproduced 22 Sep 10:34** (entry below, fixtures in `fixtures/bapi/`).
- [ ] No canonical resolver for the same ticker across issuers; the skill tells the agent to ask the user.
- [x] `baw auth signin` fails with `SERVICE_ERROR: {body.location=must not be blank}` (issues #266, #274). **Not reproduced 22 Sep**: sign-in succeeded from Nigeria over a VPN; without a VPN it cannot reach `www.binance.com` (entries below).
- [ ] The skill still routes bStock trades through `references/campaign.md` for a competition that ended 1 Sep 2026.
- [ ] Node version: 18+ in the Agentic Wallet quickstart vs 22+ in the skills hub README. (21 Sep: npm `engines` for `@binance/agentic-wallet` 1.10.0 is `>=18.0.0`; the two docs pages still to compare in a browser.)
- [ ] Agentic Wallet supported chains differ between the dev-docs page and the skills listing.
- [ ] Agent Studio trial length: 48h (docs) vs "72-24 hours" (hackathon page) vs "up to 48 hours" (launch blog).
- [ ] Agent Studio language: TypeScript (docs) vs Python (launch blog).
- [ ] `contract-call --value` is in wei while `--amount` elsewhere is in token units.
- [ ] CEX tokenized-stock API and Web3 RWA API are documented separately with no cross-links.
- [ ] Error 40369: bStocks RFQ unavailable outside exchange hours, while the token keeps trading on PancakeSwap.
- [ ] APRO tokenized-equity feeds: 1h heartbeat, 1% deviation. (22 Sep: docs say so for 12 bStocks feeds; the Tape now records `updatedAt` every 5 min, so the real cadence will be measurable after weekend 1.)
- [ ] Response envelope field names: our notes say `{ code, message, data, timestamp, success }`; the official JS connector parses `{ code, msg, data, timestamp }` and returns `data` without checking `code` (`common/src/utils.ts`, `httpRequestFunction`). **Error shape reproduced 21 Sep 15:35** (entry below): `msg`, numeric `code`, no `success`. **Success shape 22 Sep 11:28**: `{ code: 0, msg: "success", data, timestamp, success: true }`; API-level errors are HTTP 200 with `success: false`.
- [ ] recvWindow header name: our notes say `X-OC-RECV-WINDOW`; the official JS connector sends headers literally named `recvWindow` and `nonce`.
- [x] RWA endpoints cover only `platformId` `ondo` and `bstock` (connector enum); xStocks absent. **Reproduced 22 Sep 11:28**: `rwa/platforms` lists `ondo` (459 tickers) and `bstock` (77) only; `rwa/search NVDA` returns no xStocks asset (`fixtures/web3/rwa-platforms-20260922T112837Z.json`).

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

### 2026-09-22 08:50 UTC · user (dev laptop, Lagos) · Agentic Wallet
- Did: `baw auth signin`
- Expected: a QR code link
- Actual: stderr `[50001002] Connect Timeout Error (attempted address: www.binance.com:443, timeout: 10000ms)`; stdout empty. Sign-in goes through `www.binance.com`, which times out from this network without a VPN (21 Sep 13:50 entry). At 08:54 local DNS was also failing (`curl: (6) Could not resolve host: www.binance.com`; `dig`: `no servers could be reached`; google.com reachable), so this run does not isolate a Binance-side cause. Retry pending with a working VPN.
- 09:10 UTC, same result on a second `baw auth signin`. Exit network (ipinfo.io) was `AS29465 MTN NIGERIA Communication limited`, no VPN active. On that network `www.binance.com` and `api.binance.com` fail with `curl: (6) Could not resolve host` and `web3.binance.com` with `Resolving timed out after 12003 milliseconds`, while `www.google.com` returns 200. On MTN Nigeria, Binance hostnames do not resolve.
- Time lost: 20

### 2026-09-22 09:13 UTC · user (dev laptop, VPN on) · Agentic Wallet
- Did: `baw auth signin`, twice (09:13:09 and 09:25:17 UTC)
- Expected: QR code, scan in the Binance Wallet app, signed in
- Actual: both runs printed `Pairing code`, `Opening login page in browser...`, `QR Code ID`, `Expires at` and `ℹ Please scan and confirm in the app...`. The QR lifetime is 5 minutes: run 1 `Expires at: 2026-09-22 10:18:11` (created 10:13:09 WAT), run 2 `Expires at: 2026-09-22 10:30:19` (created 10:25:17 WAT). `Expires at` is local time (WAT, UTC+1) with no timezone shown. Same situation, two different outcomes: run 1 `⚠ [10001003] QR code expired` with **exit code 0**; run 2 `[10002004] QR code does not exist or expired, please try a new code or restart the log in process. [351701]` with exit code 1. What happened in the phone app: to be added.
- Run 3 (claude, 10:13:36 UTC), the flow from the official skill's `references/authentication.md`: `baw auth signin --json` returned at once with `{"success":true,"data":{"qrCodeId":"bfd9fdaf-...","expireAt":"1790072318760","urlForWeb":"https://app.binance.com/uni-qr/Xp7YFQpG","pairingCode":"648172"}}`, then `baw auth verify --qrCodeId ... --json` blocked until 10:18:39 UTC and returned `{"success":false,"error":{"code":10002004,"name":"AUTH_REJECTED","message":"QR code does not exist or expired, please try a new code or restart the log in process. [351701]"}}`. The doc's example `urlForWeb` is `https://web3.binance.com/en/agent-login?expireAt=...&url=xxx`; the real one is on `app.binance.com/uni-qr/`.
- Run 4 (10:23:34 UTC): expired the same way. Run 5 (10:30:46 UTC): user scanned with the scan icon at the top right of the Binance app's Wallet tab; `auth verify` returned `{"success":true,"data":{"status":"SUCCESS"}}` at 10:32:47 UTC; `baw wallet status --json` then `CONNECTED`. From the first attempt (08:50) to connected: about 1 h 40 min, including the MTN block. The `body.location must not be blank` error (#266, #274) did not occur.
- Time lost: 60
- Severity: slowed us
- Suggestion:

### 2026-09-22 10:33 UTC · claude (dev laptop, VPN on) · Agentic Wallet
- Did: `baw wallet status --json`, `baw wallet address --json`, `baw wallet balance --json`, `baw wallet settings --json`. (A first attempt through a zsh loop failed with `error: unknown command 'wallet status'`: my quoting, not baw.)
- Expected: connected, empty balance, limits we can set for a $25-per-trade bot
- Actual: `CONNECTED`; one EVM address shared across chains `1`, `137`, `42161`, `4663` ("Robinhood"), `56`, `8453`, plus a Solana address; `balance` `data: []`. Settings include `"dailyLimit": 50000`, `"tradeAllTokens": false`, `"maxSigninDuration": "48h"`, `"inactiveSignoutDuration": "48h"`, `"sessionExpireTime": "2026-09-24T11:33:20+01:00"`, `"signInMaxTime": "2026-09-29T11:32:43+01:00"`. The session ends after 48 h of inactivity and 7 days at most: an unattended agent needs a human QR scan at least weekly. Timestamps here carry an offset (`+01:00`); `auth signin` printed `Expires at` without one.
- Time lost: 0
- Severity: annoyance
- Suggestion:

### 2026-09-22 10:34 UTC · claude (dev laptop, VPN on) · Agentic Wallet skill / undocumented API
- Did: read `references/campaign.md` in `binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet`; `curl https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type={1,2,3}`. Fixtures: `fixtures/bapi/rwa-stock-list-type{1,2,3}-20260922T103414Z.json`
- Expected: tokenized-stock addresses from a documented endpoint
- Actual: the skill says "Address source = `type=3` API (authoritative, contains all bStock contract addresses)" and points to this `bapi` URL, which is not in the Web3 API docs. No auth needed. HTTP 200 in 2.0 to 2.8 s. Envelope `{"code":"000000","message":null,"messageDetail":null,"data":[...]}`, which differs from the Web3 API envelope (`code` 40101 numeric, `msg`). Items: `chainId`, `contractAddress`, `symbol`, `ticker`, `type`, `assetType`, `multiplier`, `lastUpdateTime`, `d`. Counts: `type=3` bStocks 77 on chain 56; `type=1` Ondo 458 on 56, 457 on 1, 451 on `CT_501`; `type=2` xStocks 128 on 56, 139 on `CT_501`. xStocks appear here but not in the documented RWA endpoints (`platformId` `ondo | bstock` only).
- Time lost: 0
- Severity: slowed us
- Suggestion:

### 2026-09-22 10:35 UTC · claude (dev laptop, VPN on) · Agentic Wallet
- Did: `baw market-order quote --binanceChainId 56 --fromTokenQty 10 --fromToken 0x55d3...7955 --toToken <NVDAB | NVDAon | NVDAx> --json` at 06:35 ET (pre-market). Fixtures: `fixtures/baw/market-order-quote-10usdt-*.json`
- Expected: a quote for each issuer's NVDA token
- Actual: NVDAB `"toCoinAmount": "0.044067618603820916"`, `"slippage": 0.01`, exit 0, 2 s. NVDAon `"toCoinAmount": "0.044011900158434707"`, `"slippage": 0.005`, exit 0, 3 s. NVDAx `{"success":false,"error":{"code":100,"name":"SERVICE_ERROR","message":"No liquidity available, please try again later."}}`, exit 1. The quote response has no route, vendor or price-impact fields.
- Time lost: 0
- Severity: annoyance
- Suggestion:

### 2026-09-22 10:58 UTC · claude (dev laptop) · oracle / BEP-677
- Did: `pnpm chain-probe` against `https://bsc-dataseed.bnbchain.org`: `latestRoundData()`, `decimals()`, `description()` on the APRO feeds from https://docs.apro.com/en/data-push/price-feed-contract, and `uiMultiplier()`, `newUIMultiplier()`, `effectiveAt()` on each bStock token. Fixtures: `fixtures/chain/*-20260922T105815Z.json`
- Expected: Chainlink-style feeds for all 5 bStocks; BEP-677 pending fields empty when nothing is scheduled
- Actual: feeds answer the Chainlink AggregatorV3 interface (8 decimals, e.g. `NVDAB/USD` = `22692509000`). The APRO docs page lists 12 bStocks feeds and **no MSTRB feed**, and states no interface, decimals or code example. `roundId` is `18446744073709553719` (above 2^64), so it does not fit a 64-bit integer. With no change scheduled, tokens return `newUIMultiplier` equal to the current `uiMultiplier` and `effectiveAt` = `0`, rather than a zero or reverting call; readers must compare values instead of checking presence. `uiMultiplier` matches the `bapi` list's `multiplier` to 18 decimals.
- Time lost: 0
- Severity: annoyance
- Suggestion:
- Severity: blocker
- Suggestion:

### 2026-09-22 11:28 UTC · user + claude (dev laptop, VPN via FR) · Web3 API / developer portal
- Did: user created a project and API key at `https://web3.binance.com/en/dev-portal/project`; keys into `.env`; `pnpm probe discover` (12 signed calls) then `pnpm probe prices` (47 calls). First successful signed response: `GET /build/api/v1/dex/market/rwa/platforms` HTTP 200 at 11:28:37 UTC, 2,366 ms (later calls 437 to 2,009 ms over the VPN).
- Expected: per PLAN T0, a stopwatch from opening the portal to the first signed 200.
- Actual: first signed call succeeded at the first attempt; no 40102 seen. **Portal steps and total time: to be filled in by the user.** Fixtures: `fixtures/web3/*-20260922T112837Z.json` onward.
- Time lost: (user to fill in)
- Severity: annoyance
- Suggestion:

### 2026-09-22 11:29 UTC · claude (dev laptop, VPN) · Web3 API
- Did: `GET /api/v1/dex/aggregator/quote` for NVDAon and NVDAx without `userWalletAddress`; `GET /api/v1/dex/market/rwa/tokens?binanceChainId=56`; `POST /api/v1/dex/market/price` with a guessed array body
- Expected: quotes for AMM tokens without a wallet (the connector says the wallet is "Required when quoting RFQ routes (equity / RWA tokens such as Ondo and BStock)"); a token list matching `platforms` (77 bStocks); a documented body for `market/price`
- Actual: 40001 `userWalletAddress is required for RFQ (Ondo) quote` and 40001 `userWalletAddress is required for RFQ (xStock) quote`, both HTTP 200; the bStocks quote worked without a wallet and reported `executionMode: SWAP`, so the RFQ/AMM split in the connector docs does not match behaviour. `rwa/tokens` on chain 56 returned 488 items: 442 `ondo` and **46 `bstock`**, while `rwa/platforms` reports 77 bStocks on chain 56 (fixtures `rwa-tokens-bsc-20260922T112837Z.json`, `rwa-platforms-20260922T112837Z.json`). `POST /market/price` with body `[{"binanceChainId":"56","tokenContractAddress":"0x..."}]` returned 200 with `[{ binanceChainId, tokenContractAddress, price, time }]` (undocumented; neither official connector can send this body).
- Time lost: 10
- Severity: slowed us
- Suggestion:

### 2026-09-22 11:30 UTC · claude (dev laptop, VPN) · Web3 API / referencePrice
- Did: compared `referencePrice` with `tokenPrice / tokenToShareRatio` for the 15 registry tokens (`fixtures/web3/rwa-price-20260922T113040Z.json`, ratios from `fixtures/bapi/`)
- Expected: one reference price per underlying stock, from the equity market
- Actual: `referencePrice` = `tokenPrice / tokenToShareRatio` to 0.00 bps for every token, and it differs by issuer for the same stock at the same second: NVDA 226.693582 (bStocks), 226.784615 (Ondo), 226.565390 (xStocks); QQQ 740.95 / 741.28 / 721.04. `/rwa/underlying-market` `marketData.referencePrice` was `null` for NVDAB and `226.639036` for NVDAon at 07:30 ET. The `/rwa/tokens` docs call the field "underlying reference price".
- Time lost: 0
- Severity: slowed us
- Suggestion:

### 2026-09-22 11:30 UTC · claude (dev laptop, VPN) · Web3 API / xStocks
- Did: `$100` USDT quotes for the 5 xStocks tokens with `userWalletAddress`; `/market/price` for the same
- Expected: AMM quotes (xStocks trade in PancakeSwap pools)
- Actual: all 5 return 40374 `Insufficient liquidity for a quote. Please decrease the transaction amount or try again later.` `/market/price` `time` for them: NVDAx 391 min old, CRCLx 396 min, TSLAx 1,255 min, QQQx 19,266 min (13.4 days), MSTRx 20,447 min (14.2 days), while bStocks and Ondo were 1 min old. MSTRx `price` 138.86 vs MSTRB 166.49.
- Time lost: 0
- Severity: annoyance
- Suggestion:

### 2026-09-22 11:29 UTC · claude (dev laptop, VPN) · Web3 API / market status
- Did: `GET /api/v1/dex/market/rwa/underlying-market` for NVDAB and NVDAon at 07:29 ET (pre-market)
- Expected: a closed or pre-market status before 09:30 ET
- Actual: NVDAB `statusInfo`: `openState: true`, `marketStatus: null`, `reasonCode: "TRADING"`, `nextOpenTime: null`. NVDAon: `openState: true`, `marketStatus: "premarket"`, `reasonCode: "TRADING"`, `nextOpenTime: 1790083860000` (13:31 UTC), `nextCloseTime: 1790083740000` (13:29 UTC, i.e. before the next open). Same field, different meaning per issuer.
- Time lost: 0
- Severity: annoyance
- Suggestion:

### 2026-09-22 12:14 UTC · claude (dev laptop, VPN) · Web3 API / aggregator quote
- Did: `GET /api/v1/dex/aggregator/quote` USDT → NVDAon at $100, $1,000 and $10,000 with `userWalletAddress` (Tape run 3, local; raw in `raw_json`)
- Expected: a worse but sane price at size, and `priceImpactPercent` to describe it
- Actual: $100 → 0.4399 NVDAon ($227.32 each, route `Rfq Halfmoon` 100%, `priceImpactPercent` 0.0001). $1,000 → 4.354 ($229.66 each, `Rfq Halfmoon` 20% / `Pancakeswap V3` 80%, impact 0.0129). **$10,000 → 12.152 NVDAon ($822.88 each**, `Pancakeswap V3` 97.2% / `Rfq Halfmoon` 2.8%, `priceImpactPercent` 0.7246, `isBest: true`, `toToken.tokenUnitPrice` 227.15). The quote is 262% above the unit price it reports; `priceImpactPercent` says 0.72%. bStocks at the same sizes: $227.02 / $227.03 / $227.08.
- Time lost: 0
- Severity: slowed us
- Suggestion:
