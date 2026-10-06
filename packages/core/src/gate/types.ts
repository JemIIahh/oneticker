import type { MarketState } from '../market';

export type Verdict = 'GO' | 'CAUTION' | 'BLOCK';

export type ReasonCode =
  | 'REF_MISSING'
  | 'REF_STALE'
  | 'PREMIUM_HIGH'
  | 'ORACLE_STALE'
  | 'ORACLE_DIVERGENCE'
  | 'PERP_DIVERGENCE'
  | 'IMPACT_HIGH'
  | 'MULTIPLIER_PENDING'
  | 'VENUE_HALTED';

export interface Reason {
  code: ReasonCode;
  detail: string;
}

export interface GateResult {
  verdict: Verdict;
  reasons: Reason[];
  policy: string;
}

interface Threshold {
  caution: number;
  block?: number;
}

export interface Policy {
  id: string;
  referenceAgeSec: Threshold;
  premiumBps: Threshold;
  oracleAgeSec: Threshold;
  oracleDivergenceBps: Threshold;
  impactBps: Threshold;
  /** Executable price against the live 24/7 perp while the US market is closed. Optional: a policy without it skips the rule. */
  perpDivergenceBps?: Threshold;
}

/** What the gate sees for one route. Every price is a share-equivalent price (SEP) in USD; null means unknown. */
export interface GateInput {
  side: 'buy' | 'sell';
  marketState: MarketState;
  /** Seconds since the last real reference trade. */
  referenceAgeSec: number;
  referenceSep: number | null;
  /** Executable SEP at the requested size. */
  executableSep: number;
  /** Executable SEP at $100, the impact baseline. */
  executableSep100: number | null;
  oracleSep: number | null;
  oracleAgeSec: number | null;
  /**
   * SEP of the Binance TradFi perpetual on the stock, which trades 24/7. While the US market is closed it is the only live
   * price of the stock. Absent or null means unknown: the rule is skipped and the verdict is unchanged.
   */
  perpSep?: number | null;
  multiplierPending: boolean;
  halted: boolean;
}
