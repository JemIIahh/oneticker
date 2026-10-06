# What the Tape saw (generated)

Generated 2026-10-06T06:52 UTC by `pnpm --filter tape analyze` from the laptop Docker Tape (Fri 2 Oct to Tue 6 Oct), copied 6 Oct 07:42 UTC. Do not edit by hand: rerun the script.

## Window and coverage

2026-10-01T10:44:10.732Z to 2026-10-06T06:40:00.039Z UTC (116 hours), 3,620 samples (one run times one instrument) across 5 instruments. 724 successful runs against about 1392 possible at 5-minute spacing (52%): the Tape ran on a laptop, so it slept, lost its VPN and fell behind the slot in places. Every figure below describes the samples that exist, not the whole window.

| Market | Samples | Perp | Pool | Oracle | Any $100 quote | xStocks $100 quote |
| --- | --- | --- | --- | --- | --- | --- |
| US open | 1035 | 69% | 93% | 74% | 68% | 0% |
| Weeknight (closed) | 740 | 85% | 94% | 75% | 84% | 0% |
| Weekend (closed) | 1845 | 72% | 88% | 70% | 71% | 0% |

Columns show the share of samples that have that surface. Binance-sourced surfaces (perp, quotes) are missing whenever the laptop was outside an allowed country; the pool and oracle are read from BSC and are always available.

## 1. Which issuer is cheaper, and what choosing wrong costs

Samples where bStocks and Ondo both returned a buy quote. Regret is how much more a fixed choice charged per share than the cheaper of the two. xStocks never quoted, so always choosing it would have failed every time.

| Size | Market | Samples | bStocks cheapest | Always bStocks: mean / p90 regret | Always Ondo: median / p90 regret | Ondo over 10% worse |
| --- | --- | --- | --- | --- | --- | --- |
| $100 | US open | 510 | 73% | 1.9 / 7.0 bps | 0.5% / 2.1% | 0% |
| $100 | Weeknight (closed) | 426 | 69% | 1.8 / 6.4 bps | 0.3% / 1.7% | 0% |
| $100 | Weekend (closed) | 955 | 76% | 1.7 / 7.1 bps | 0.2% / 1.7% | 0% |
| $1,000 | US open | 398 | 72% | 1.9 / 8.0 bps | 15.3% / 103% | 62% |
| $1,000 | Weeknight (closed) | 324 | 76% | 1.5 / 7.0 bps | 14.8% / 91.9% | 64% |
| $1,000 | Weekend (closed) | 736 | 78% | 1.7 / 7.2 bps | 4.1% / 103% | 45% |
| $10,000 | US open | 394 | 97% | 0.7 / 0.0 bps | 259% / 1910% | 91% |
| $10,000 | Weeknight (closed) | 314 | 97% | 0.6 / 0.0 bps | 258% / 1800% | 96% |
| $10,000 | Weekend (closed) | 727 | 78% | 1.7 / 7.2 bps | 759% / 1913% | 77% |

## 2. On-chain pool against the 24/7 perp

bStocks pool price per share against the Binance TradFi perp mark, in bps (p10 / p50 / p90). Negative means the pool is below the perp. "Beyond cap" is the share of samples farther than 75 bps either way, the gate's premium caution level.

| Market | Samples | Pool vs perp (bps) | Largest gap (bps) | Beyond cap |
| --- | --- | --- | --- | --- |
| US open | 703 | -27.3 / -4.5 / 18.8 | 100 | 0% |
| Weeknight (closed) | 621 | -27.6 / -6.7 / 7.9 | 76 | 0% |
| Weekend (closed) | 1304 | -29.8 / -11.9 / 0.1 | 36 | 0% |

| Instrument | US open (p10 / p50 / p90) | Weeknight (closed) (p10 / p50 / p90) | Weekend (closed) (p10 / p50 / p90) |
| --- | --- | --- | --- |
| US:NVDA | -30.0 / -2.9 / 20.1 | -33.1 / -12.9 / 4.0 | -25.2 / -12.3 / 4.6 |
| US:TSLA | -32.4 / -10.5 / 18.8 | -25.4 / -7.9 / 5.9 | -31.4 / -16.3 / -3.2 |
| US:QQQ | -9.0 / -4.5 / 2.0 | -9.0 / -6.0 / -3.4 | -6.5 / -3.6 / -1.7 |
| US:CRCL | -24.2 / 0.8 / 22.6 | -24.5 / -6.0 / 11.6 | -28.5 / -13.8 / 4.2 |
| US:MSTR | -28.2 / -4.5 / 17.0 | -29.5 / -9.0 / 11.4 | -33.4 / -22.7 / 2.3 |

## 3. The oracle

APRO feed per share against the perp, in bps, and how old the feed's last update was. The gate cautions beyond 100 bps and blocks beyond 300; it cautions when the feed is older than 60 minutes and blocks beyond 120. MSTR has no feed.

| Market | Samples | Oracle vs perp (bps) | Largest gap (bps) | Beyond caution | Beyond block | Feed age, minutes |
| --- | --- | --- | --- | --- | --- | --- |
| US open | 562 | -59.0 / -12.3 / 32.0 | 276 | 3% | 0% | 4 / 27 / 53 |
| Weeknight (closed) | 496 | -49.2 / -17.8 / 4.4 | 143 | 1% | 0% | 5 / 27 / 53 |
| Weekend (closed) | 1041 | -28.6 / -14.9 / -5.2 | 56 | 0% | 0% | 5 / 29 / 53 |

## 4. The gate, replayed

The shipped gate (`default@1`) run over the cheapest $1,000 route in each sample, with the perp as a live reference (reference age zero) so the premium rule has something real to compare against. Separately, the gate's reference-age rule needs no price at all: it fires on 95% of closed-market samples (older than 60 minutes since the last close), so with a last-close reference the verdict is CAUTION for essentially every closed hour.

| Market | Samples | GO | CAUTION | BLOCK | Reasons that fired |
| --- | --- | --- | --- | --- | --- |
| US open | 703 | 98% | 1% | 0% | ORACLE_DIVERGENCE 1%, PREMIUM_HIGH 0%, IMPACT_HIGH 0% |
| Weeknight (closed) | 614 | 99% | 1% | 0% | ORACLE_DIVERGENCE 1%, PREMIUM_HIGH 0%, IMPACT_HIGH 0% |
| Weekend (closed) | 1294 | 100% | 0% | 0% | none |

## Method and limits

- A sample is one Tape run for one instrument. Prices are per share: token price divided by the venue's shares-per-token ratio.
- The perp is a yardstick, not truth. The Tape has no equity reference (Finnhub is pending) and a perp has its own basis and funding.
- "Weekend" means closed with more than 48 hours between the last close and the next open. "Weeknight" is every other closed hour. Both come from the market clock in `packages/core`.
- Quotes are what the Binance aggregator returned; no trade was executed. Ondo size quotes in particular route through thin pools and can be many times the $100 price.
- Coverage is uneven and the sample is a few days. Treat these as a first look, not a distribution.
