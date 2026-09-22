/** Plain-English reasons for API error codes that exclude a venue from a route (SPEC 3.6). */
export const EXCLUSION_REASONS: Record<string, string> = {
  '40374': 'No liquidity from any vendor right now',
  '40365': 'Ondo-only mode is on but this pair has no Ondo token',
  '40366': "Larger than the market maker's single-order limit (try splitting)",
  '40367': 'Underlying market is closed; this venue will not quote',
  '40369': 'bStocks RFQ is unavailable outside exchange hours',
  '40375': "Below Ondo's minimum order size",
  // Not in the official error-code docs; found 22 Sep on every Railway region (US, Singapore, Netherlands).
  '40304': 'Blocked in this region (Binance compliance restriction)',
  NO_API_KEYS: 'Quote service is not configured',
  NO_PRICE: 'No price to size a sell quote from yet',
  NO_QUOTE: 'Quote service returned nothing',
  NETWORK_ERROR: 'Quote service could not be reached',
  TIMEOUT: 'Quote service timed out',
};

/** Known codes get their sentence; unknown ones are surfaced verbatim so they get logged, never hidden. */
export function exclusionReason(code: string): { known: boolean; reason: string } {
  const reason = EXCLUSION_REASONS[code];
  return reason ? { known: true, reason } : { known: false, reason: `Venue returned error ${code}` };
}
