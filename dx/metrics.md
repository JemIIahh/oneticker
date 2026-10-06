# API metrics (generated)

Generated 2026-10-06T06:57 UTC by `pnpm --filter tape metrics` from the Tape's `api_calls` table. Do not edit by hand.

## 22 to 24 Sep: data/tape.sqlite

Copied into the repo's data/tape.sqlite on 24 Sep 22:29. The file does not record where it ran. It holds no 40304 responses, so it is not the Railway Tape's log (that log was never backed up); these calls came from somewhere Binance answered. Treat the latency as unattributed.

25,504 calls, 2026-09-22T12:14:37.976Z to 2026-09-24T21:29:11.300Z UTC.

| Endpoint | Calls | Succeeded | p50 ms | p95 ms |
| --- | --- | --- | --- | --- |
| `/api/v1/dex/aggregator/quote` | 16,031 | 44.1% | 806 | 2,867 |
| `/api/v1/dex/market/rwa/underlying-market` | 3,515 | 67.5% | 1,047 | 3,262 |
| `api.binance.com/api/v3/ticker/price` | 1,752 | 69.7% | 1,442 | 4,684 |
| `www.binance.com/bapi/margin/v1/public/margin/price-index` | 1,752 | 69.5% | 1,975 | 5,465 |
| `fapi.binance.com/fapi/v1/premiumIndex` | 1,750 | 69.9% | 670 | 2,954 |
| `/api/v1/dex/market/rwa/price` | 352 | 59.9% | 2,562 | 4,012 |
| `/api/v1/dex/market/price` | 352 | 66.2% | 506 | 2,427 |

Latency is for successful calls only. Failed calls, by HTTP status and error code (status 0 means no response arrived):

| HTTP status | Code | Calls | Median ms |
| --- | --- | --- | --- |
| 0 | NETWORK_ERROR | 7,216 | 2 |
| 200 | 40374 | 3,708 | 827 |
| 0 | TIMEOUT | 399 | 10,003 |
| 401 | 40103 | 342 | 7,743 |
| 429 | 42900 | 224 | 658 |
| 200 | 40367 | 60 | 687 |

## 1 to 6 Oct: laptop Docker Tape over a French VPN

Run from a laptop in Lagos through a French VPN exit. All of 5 Oct has no successful Binance call (the VPN was off), and the call log has gaps where the laptop slept. Latency includes the VPN hop and must not be quoted as Binance's own.

52,276 calls, 2026-10-01T10:35:12.571Z to 2026-10-06T06:40:10.855Z UTC.

| Endpoint | Calls | Succeeded | p50 ms | p95 ms |
| --- | --- | --- | --- | --- |
| `/api/v1/dex/aggregator/quote` | 32,674 | 40.0% | 740 | 2,321 |
| `/api/v1/dex/market/rwa/underlying-market` | 7,260 | 72.0% | 971 | 2,581 |
| `api.binance.com/api/v3/ticker/price` | 3,630 | 73.0% | 1,282 | 2,270 |
| `www.binance.com/bapi/margin/v1/public/margin/price-index` | 3,630 | 72.7% | 1,757 | 2,951 |
| `fapi.binance.com/fapi/v1/premiumIndex` | 3,630 | 73.4% | 615 | 2,621 |
| `/api/v1/dex/market/rwa/price` | 726 | 67.5% | 2,262 | 3,648 |
| `/api/v1/dex/market/price` | 726 | 69.7% | 504 | 1,393 |

Latency is for successful calls only. Failed calls, by HTTP status and error code (status 0 means no response arrived):

| HTTP status | Code | Calls | Median ms |
| --- | --- | --- | --- |
| 0 | NETWORK_ERROR | 13,790 | 12 |
| 200 | 40374 | 10,517 | 805 |
| 0 | TIMEOUT | 414 | 10,012 |
| 401 | 40103 | 212 | 7,934 |
| 200 | 40367 | 76 | 658 |
| 429 | 42900 | 4 | 530 |
