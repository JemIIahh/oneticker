import type { MarketState } from '../market';

export type Verdict = 'GO' | 'CAUTION' | 'BLOCK';

export type ReasonCode =
  | 'REF_MISSING'
  | 'REF_STALE'
  | 'PREMIUM_HIGH'
  | 'ORACLE_STALE'
  | 'ORACLE_DIVERGENCE'
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
  multiplierPending: boolean;
  halted: boolean;
}
