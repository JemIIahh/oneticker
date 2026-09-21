export type Issuer = 'bstocks' | 'ondo' | 'xstocks';

export type ExecutionPath = 'RFQ_BSTOCK' | 'RFQ_ONDO' | 'AMM';

export interface Venue {
  issuer: Issuer;
  /** Token symbol on BSC, e.g. NVDAB, NVDAon. */
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  path: ExecutionPath;
}

export interface Instrument {
  /** e.g. US:NVDA */
  id: string;
  ticker: string;
  name: string;
  venues: Venue[];
}

/** RWA endpoints cover only these issuers (connector enum: ondo | bstock). */
export function isRwaVenue(venue: Venue): boolean {
  return venue.issuer === 'bstocks' || venue.issuer === 'ondo';
}
