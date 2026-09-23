# Research notes

Desk research from 20 Sep 2026. **Source** means a primary or reputable source was found; it still has not been checked against our own API calls. **Unverified** means no source was found or sources disagree. Update statuses as fixtures come in.

## 1. Hackathon

| Fact | Status |
|---|---|
| Single track. No category selection on the submission form. | Source |
| $20,000 main pool, placements not published | Source |
| $2,000 Best Use of Agentic Wallet / Wallet Skills: "deepest, most credible use of the AI execution layer" | Source |
| $2,000 Best Use of BNB Agent Studio: "agent identity, autonomous runtime, self-funding via x402" | Source |
| A project can win a main placement and a special prize | Source |
| Judging: technical 30%, creativity 25%, DX report 25%, product and UX 20% | Source |
| Submission: public repo, demo video 4:00 max (recommended), deployed link or run instructions, mandatory DX report | Source |
| Deadline Sun 11 Oct 2026 12:00 UTC; judging 12 to 23 Oct; winners week of 26 Oct | Source |
| Excluded: US, Canada, Netherlands, UK, Japan, Iran, Cuba, North Korea, Crimea, DPR, LPR | Source |

## 2. Issuers on BNB Chain

**bStocks (Binance).** Launched 11 Jun 2026. Issuer BTech Holdings Ltd. 1:1 backed by US shares at an unnamed custodian; daily Proof of Collateral page. BEP-20 plus BEP-677 (scaled UI amount). Suffix `B` (NVDAB, TSLAB, METAB, MSFTB, PLTRB, AMDB, MSTRB, QQQB, CRCLB, SPCXB...). Ticker count differs by source (15 in July, 67+ in August, 77 per RWA.xyz on 20 Sep). Freely transferable; issuer can blacklist addresses. Mint and redeem only for eligible KYC'd Binance users, zero conversion fee, pauses during corporate actions. About $750M outstanding.

**Ondo Stocks.** On BNB Chain since 29 Oct 2025. 450+ stocks and ETFs across Ethereum, BNB Chain, Solana. Suffix `on` (NVDAon, TSLAon, SPYon, QQQon, CRCLon). Independent verification agent and security agent. True 24/7 mint and redeem since 25 Jun 2026 for eligible non-US persons. About $850M outstanding, the largest issuer.

**xStocks (Backed / Kraken).** On BNB Chain since 30 Apr 2026. 50+ tickers at launch. Freely transferable. Liquidity on PancakeSwap and CowSwap. Suffix believed to be `x` (unverified).

**Liquidity.** Binance spot is deepest for bStocks. PancakeSwap v3 is the largest DEX venue for tokenized stocks globally and has a stocks terminal at pancakeswap.finance/stocks. Aster offers bStocks perps (the only way to short).

## 3. Market structure

- US market open about 32.5 of 168 hours per week.
- **Binance bStocks collateral index**: while the US market is open, it blends third-party equity prices with Binance futures; while closed, it references the last valid close and **stays fixed** until the next session. (Source: Binance FAQ.)
- **APRO**: bStocks price feeds free to builders since 17 Sep 2026. Tokenized-equity feeds on BSC use a 1-hour heartbeat and 1% deviation threshold.
- **Chainlink Tokenized Equity Feeds**: 24/5 pricing across pre, regular, post and overnight sessions; issuers listed include Ondo. Coverage of bStocks and deployment on BSC unverified.
- **Corporate actions**: all three issuers reinvest dividends net of withholding (total return), no cash payouts. bStocks apply dividends and splits by changing the BEP-677 multiplier.
- **BEP-677 hazards** (from the spec itself): protocols that cache `balanceOf` break; round-tripping UI amounts loses value; on overflow the reference implementation returns a UI amount of 0; `effectiveAt` is advisory, so there is no guaranteed notice window.
- No published data on the size of weekend premiums or discounts. **This is the gap the Tape fills.**

## 4. DeFi state

- **Venus**: TSLAB, NVDAB, SPCXB as collateral (collateral factors 60 / 60 / 50%) with **borrow caps at 0** at launch. Current parameters unverified.
- **Lista DAO**: bStocks collateral live since 16 Jun 2026. LTVs, caps and oracle unverified.
- **Aster**: bStocks perps; bStocks usable as collateral.
- No proven liquidation behavior while the US market is closed. No options or structured products. No cross-issuer fungibility.

## 5. Binance Web3 API

Base `https://web3.binance.com/build`. WebSocket `wss://web3-stream.binance.com/w3w`. Auth and rate limits in `CLAUDE.md`.

**Official connector** (Source, 21 Sep, from code not calls): `@binance-web3/wallet` 12.3.0, github.com/binance/binance-web3-connector-js, covers RWA, market, trading, transaction, DeFi, B402 and wallet modules. Param names below come from it.

**RWA / tokenized stocks** (all under `/api/v1/dex/market/rwa/`, all GET): `platforms` (`platformId?`), `tokens` (`binanceChainId?`, `platformId?`, `tabId?`), `search` (`keyword`, `platformId?`), `price` (`binanceChainId`, `tokenContractAddresses` comma-separated, max 100), `underlying-profile` and `underlying-market` (`binanceChainId`, `tokenContractAddress`). `platformId` enum is `ondo | bstock` only: **xStocks does not appear in the RWA endpoints** (Source: connector enum; confirm with a fixture).

**Confirmed by fixtures, 22 Sep** (`fixtures/web3/*-20260922T11*.json`): success envelope `{ "code": 0, "msg": "success", "data", "timestamp", "success": true }`; errors `{ "code": 40001, "msg", "data": null, "timestamp", "success": false }` with HTTP 200. `POST /market/price` takes a JSON array body `[{ "binanceChainId", "tokenContractAddress" }]` and returns `[{ binanceChainId, tokenContractAddress, price, time }]`. `/rwa/price` items: `tokenPrice`, `referencePrice`, `tokenPriceUpdatedAt`. `/rwa/tokens` items carry `tokenToShareRatio`, `statusInfo { openState, marketStatus, reasonCode, nextOpenTime, nextCloseTime }`, `tokenPrice`, `referencePrice`, `volume24H`, `marketCap`, `peRatioTTM`. Aggregator quote items: `quoteId`, `vendorName`, `executionMode`, `fromTokenAmount`, `toTokenAmount` (smallest units), `tradeFee`, `estimateGasFee`, `priceImpactPercent`, `toToken.tokenUnitPrice`, `dexRouterList`, `approveTarget`. `userWalletAddress` is required for Ondo **and xStocks** quotes (40001 otherwise), not only Ondo/bStocks as the connector says.

**Aggregator quote** (Source: connector): `GET /api/v1/dex/aggregator/quote` with `binanceChainId`, `amount` (smallest unit), `fromTokenAddress`, `toTokenAddress`, `vendor?` (`LiquidMesh | Pancake | Jupiter`), `userWalletAddress` (required for RFQ routes: Ondo, bStocks). RFQ vendor names seen in docs: `InchFusion`, `CowSwap`, `PcsXRfq`.

**Market**: `/api/v1/dex/market/` `price` (batch up to 100), `candles`, `token/search`, `token/basic-info`, `token/advanced-info`, `price-info`, `token/top-liquidity`, `trades`, `token/holder`, plus portfolio endpoints.

**Trading**: `/api/v1/dex/aggregator/` `quote`, `swap`, `quote-and-swap`, `approve-transaction`, `history`, `order/submit` (RFQ, equity tokens only), `order/{orderId}`. Routing by issuer: Ondo via multi-vendor RFQ; bStocks via LiquidMesh or PcsXRfq; xStocks via AMM pools. Integrator fee 0 to 5% on EVM.

**Observed routing (verified 22 to 23 Sep, `fixtures/web3/aggregator-quote-*`):** every bStocks and Ondo quote has `vendorName: "LiquidMesh"` and `executionMode: "SWAP"`; `dexRouterList[].dexProtocol.dexName` names the filling venue and it changes between quotes for the same token. MSTRB: `Metric` (22 Sep 11:29) then `Rfq Neptunex` (23 Sep 06:59). NVDAB: `Kipseli` then `Metric`. NVDAon: `Rfq Halfmoon` then `Metric`. QQQB: `Metric` and `Fluxpool V2` one minute apart. TSLAon, QQQon, MSTRon: `Rfq Halfmoon` both days. xStocks: `40374` no liquidity both days. So the execution path is per quote, not per issuer; `quote_route` reports it as `LiquidMesh via <dexName>`. Not yet seen: `PcsXRfq`, or any `executionMode` other than `SWAP`.

**Transaction**: `pre-transaction/simulate`, `broadcast-transaction`, `post-transaction/orders`, `gas-price`, `gas-limit`, `block-height`.

**Wallet**: balances and history. **DeFi**: BSC only, 15 protocols readable, 10 transactable, 5 QPS.

**Trading error codes**: 40365, 40366, 40367, 40369, 40374, 40375 (meanings in SPEC 3.6).

## 6. Agentic Wallet (`baw`)

- MPC keyless wallet driven by an agent; spending limits and token scope set only in the Binance app.
- Integration is a `SKILL.md` that instructs the agent to run `baw ... --json`. Install: `npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet`. npm package `@binance/agentic-wallet`.
- Commands: `auth`, `wallet`, `market-order swap`, `limit-order`, `contract-call` (developer mode), `sign-message` (EIP-712), `prediction`, `x402-payment`, `defi`.
- Skill routes tokenized-stock types via an internal endpoint: `type=1` Ondo, `type=2` xStocks-style, `type=3` bStocks.
- Skill notes limit orders can fail with `Ondo-related tokens cannot be traded`.
- Open issues #266 and #274: sign-in fails on a missing `location` field.

## 7. BNB Agent Studio (`bag`)

- TypeScript scaffolder and runtime. `npm i -g @bnbagent/studio-cli`, `bag skills install`, `bag doctor`, `bag dev`. Needs Node 22+, pnpm 10, Bun 1.3+ for deploy.
- Generated project: editable `sellerCore.ts`; fixed `signing.ts` (signing never exposed to the LLM); read-only `tools.ts`.
- Faces: A2A (:9000), MCP (:8000/mcp), x402. Commerce: ERC-8183, B402, or both. Identity: ERC-8004 (gas-free on testnet via MegaFuel).
- Deploy targets: `bnb` (managed 48h testnet trial; signing material leaves your control), `aws` (AgentCore), `azure`.
- Self-refill: the agent tops up its LLM budget via x402 from $U; example cost about $0.31 overnight.
- Troubleshooting page lists known sharp edges (network drift in `studio.toml`, pnpm workspace errors, AgentCore naming rules, `--accept-risk` on first deploy).

## 8. Other tooling

- Binance MCP (`https://agent.binance.com/mcp/agentic`): CEX only.
- `bnbchain-mcp` (`npx @bnb-chain/mcp@latest`): chain reads, ERC-8004 registration. Not for public deployment.
- `bnbagent-sdk` (`@bnbagent/sdk`, `bnbagent`): ERC-8004 and ERC-8183.
- `binance-skills-hub`: about 1,000 stars, the main skills repo.

## 9. Unverified (numbers match CLAUDE.md)

| # | Question | Resolved in | Status |
|---|---|---|---|
| 1 | What `referencePrice` is: real quote or derived from on-chain price | T1 | **Answered 22 Sep: derived.** In `fixtures/web3/rwa-price-20260922T113040Z.json`, `referencePrice` = `tokenPrice` ÷ `tokenToShareRatio` to within 0.00 bps for all 15 tokens (e.g. NVDAB 226.87 / 1.000778 = 226.6936 = `referencePrice`), and each issuer gets a different "reference" for the same stock (NVDAB 226.69, NVDAon 226.78, NVDAx 226.57). It is the on-chain token price restated per share, not a market quote. **Consequence:** an independent equity quote (Finnhub) is the primary reference; `referencePrice` is only a per-share view of `tokenPrice`. |
| 2 | bStocks price per raw unit or UI unit; share ratio per venue | T1 | **Answered 22 Sep.** `tokenPrice` in `/rwa/price`, `price` in `/market/price`, the aggregator's `tokenUnitPrice`, the APRO feed and baw all price one raw token; `referencePrice` is that price per share. Share ratio: `tokenToShareRatio` on `/rwa/tokens` items (bStocks: equals on-chain `uiMultiplier`; Ondo: issuer value, e.g. NVDAon 1.001715; xStocks on BSC: 1). Earlier notes: The `bapi` `multiplier` equals the on-chain BEP-677 `uiMultiplier` exactly (NVDAB `1000778223752807865` / 1e18, `fixtures/chain/bep677-NVDAB-20260922T105815Z.json`), so the bStocks share ratio is on-chain and the Ondo/xStocks ratios come from the same list. baw quotes and the APRO feed both price one raw token. Still open: whether the Web3 API `/rwa/price` is per raw or UI unit (needs keys). Earlier lead (22 Sep): the `bapi` list carries a `multiplier` per token (NVDAB `1.000778223752807865`, NVDAon `1.0017152487959898`, every xStocks token on BSC `1`). Dividing the 22 Sep 06:35 ET `baw` quotes by it gives NVDAB about $226.74 and NVDAon about $226.82 per share, within 0.04%, which suggests quotes are per token and the multiplier is shares per token. Confirm against BEP-677 `uiMultiplier` on-chain. Earlier lead (21 Sep): closing-bell-agent's demo fixture shows `tokenToShareRatio` on `rwa/tokens` items, plus `underlyingTicker`, `decimals`, `statusInfo.openState / marketStatus / nextOpenTime`. Its fixtures look hand-made; confirm with ours. |
| 3 | All 5 candidate instruments listed on BSC by all three issuers | T1 | **Answered 22 Sep: yes.** NVDA, TSLA, QQQ, CRCL, META, MSFT and MSTR all exist on chain 56 as `B`, `on` and `x` tokens (`fixtures/bapi/rwa-stock-list-type{1,2,3}-20260922T103414Z.json`); NVDA addresses confirmed on-chain via `symbol()`. Execution paths (22 Sep 07:30 ET, $100 USDT quotes with `userWalletAddress`): all 5 bStocks and all 5 Ondo tokens quote via `vendorName: LiquidMesh`, `executionMode: SWAP` (bStocks route `Kipseli`, Ondo route `Rfq Halfmoon`); **all 5 xStocks return 40374** "Insufficient liquidity for a quote", and their `/market/price` timestamps are 6 h (NVDAx) to 14 days (MSTRx) old. xStocks on BSC barely trade; keep the venue, expect "excluded" most of the time. |
| 4 | `baw auth signin` works from Nigeria | T2 | **Answered 22 Sep: yes, with a VPN.** On MTN Nigeria `www.binance.com` does not resolve, so sign-in cannot start; over a VPN it succeeded on the 5th QR (codes last 5 min). #266/#274 error not seen. dx/LOG.md 22 Sep entries. |
| 5 | `baw market-order swap` handles bStocks and Ondo directly | T2 / T9 | **Partly answered 22 Sep:** `baw market-order quote` returns quotes for NVDAB and NVDAon directly (`fixtures/baw/`), so no hand-built RFQ was needed for a quote. Swap execution untested until the wallet is funded (T9). |
| 6 | APRO feed addresses and interface on BSC | T4 | **Answered 22 Sep.** 12 bStocks feeds listed at docs.apro.com (addresses in `packages/clients/src/chain/apro.ts`); Chainlink AggregatorV3 interface confirmed live (`decimals()` = 8, `description()` = `NVDAB/USD`, `latestRoundData()`), fixtures `fixtures/chain/apro-*-20260922T105815Z.json`. The feed prices the **token** (NVDAB/USD 226.925 vs baw's 226.92 per token), not the share. Feeds updated during pre-market (ages 169 s to 1,940 s at 06:58 ET). **MSTRB has no APRO feed**; Ondo and xStocks have none. |
| 7 | Public endpoint for the bStocks collateral index | T4 | **Answered 22 Sep, yes.** `GET https://www.binance.com/bapi/margin/v1/public/margin/price-index?symbol=NVDABUSDT` (undocumented, no key; bapi envelope, `data: {symbol, price, timestamp}`), per token. It equals the `indexPrice` of the TradFi perp `fapi/v1/premiumIndex?symbol=NVDAUSDT`. Sources from `fapi/v1/constituents` (prices hidden as -1). At 23:10 UTC on a Tuesday, 3 h after the close, it was **not frozen** (moved each 20 s poll), contradicting the FAQ; whether it freezes over the weekend is unverified until the Tape's weekend-1 data. Fixtures `fixtures/binance/`. Recorded by the Tape from 22 Sep (`index_px`). Related finding: Binance runs `TRADIFI_PERPETUAL` futures on all 5 underlyings (NVDA, TSLA, QQQ, CRCL, MSTR), recorded per instrument in the `underlying` table. |
| 8 | xStocks symbol suffix on BSC | T1 | **Answered 22 Sep: `x`** (NVDAx, on-chain `symbol()` = `NVDAx`, address `0xc845...849d`). |
| 9 | Hackathon "elevated rate limits" in numbers | T0 | open |
| 10 | Current Venus and Lista parameters for bStocks | could-have | open |
| 11 | Agent Studio runtime can be self-hosted outside AWS / Azure | T10 | open |

## Sources

- Hackathon: https://www.bnbchain.org/en/hackathons/tokenized-stocks
- BNB Chain on remaining gaps: https://www.bnbchain.org/en/blog/the-next-step-for-tokenized-equities-funding-paths-matter-after-assets-move-onchain
- bStocks on BNB Chain: https://www.bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody
- bStocks guide: https://www.binance.com/en/academy/articles/what-are-bstocks-a-guide-to-tokenized-stocks-on-binance
- Collateral index FAQ: https://www.binance.com/en/support/faq/detail/131946c44eb5428fa249c639cc60e43b
- BEP-677: https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md
- Ondo on BNB Chain: https://ondo.finance/blog/global-markets-live-on-bnb-chain
- Ondo 24/7: https://ondo.finance/blog/real-24-7-trading-for-tokenized-stocks
- xStocks on BNB Chain: https://xstocks.fi/us/news/xstocks-launches-on-bnb-chain
- Free bStocks feeds via APRO: https://cryptobriefing.com/bnb-chain-free-bstocks-price-feeds/
- APRO feed docs: https://docs.apro.com/en/data-push/price-feed-contract
- Chainlink tokenized equity feeds: https://docs.chain.link/data-feeds/tokenized-equity-feeds
- Venus collateral: https://cryptoslate.com/tokenized-stocks-defi-collateral-venus/
- PancakeSwap volumes: https://cryptobriefing.com/pancakeswap-v3-tokenized-stocks-dex-volume/
- RWA.xyz stocks: https://app.rwa.xyz/stocks
- Web3 API docs: https://web3.binance.com/en/dev-docs/introduction
- Trading error codes: https://web3.binance.com/en/dev-docs/products/trading-api/error-codes
- Agentic Wallet: https://developers.binance.com/docs/agentic-wallet/welcome
- Skills hub: https://github.com/binance/binance-skills-hub
- Agent Studio docs: https://docs.bnbchain.org/developer-kit/bnbchain-studio/
- Agent Studio deployment: https://docs.bnbchain.org/developer-kit/bnbchain-studio/deployment/
- Binance MCP (CEX): https://developers.binance.com/en/docs/agent-native/mcp-server/agentic
- bnbchain-mcp: https://github.com/bnb-chain/bnbchain-mcp
- PlumS: https://plumstock.xyz/
- closing-bell-agent: https://github.com/daveaire/closing-bell-agent
