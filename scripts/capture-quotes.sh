#!/usr/bin/env bash
# T5: run `pnpm oneticker quote <T> buy <amount>` for all five stocks and save the raw output to docs/quotes/.
#   scripts/capture-quotes.sh [amount]      default $500
# Needs the VPN on an allowed country (France): Binance's Web3 API refuses most others.
set -u
cd "$(dirname "$0")/.."
AMOUNT="${1:-500}"
STAMP="$(date -u +%Y%m%dT%H%MZ)"
OUT="docs/quotes/quotes-${STAMP}.txt"
{
  echo "# oneticker quote, buy \$${AMOUNT}, captured $(date -u '+%a %d %b %Y %H:%M UTC')"
  echo "# exit country: $(curl -s -m 8 ipinfo.io/country || echo unknown)"
  echo
  for T in NVDA TSLA QQQ CRCL MSTR; do
    pnpm --silent oneticker quote "$T" buy "$AMOUNT" 2>&1 | grep -v '^$' | grep -v '^> '
    echo
    echo '---'
    echo
  done
} | tee "$OUT"
echo "saved $OUT" >&2
