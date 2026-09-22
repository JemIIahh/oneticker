import defaultPolicyJson from '../../policy/default.json';
import type { GateInput, GateResult, Policy, Reason, Verdict } from './types';

export const defaultPolicy: Policy = defaultPolicyJson;

const RANK: Record<Verdict, number> = { GO: 0, CAUTION: 1, BLOCK: 2 };

export function formatDuration(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** (a / b - 1) in basis points. */
export const bps = (a: number, b: number): number => (a / b - 1) * 10_000;

const fmtBps = (x: number) => `${Math.round(Math.abs(x))} bps`;

function grade(value: number, t: { caution: number; block?: number }): Verdict {
  if (t.block !== undefined && value > t.block) return 'BLOCK';
  if (value > t.caution) return 'CAUTION';
  return 'GO';
}

/**
 * The deterministic gate (SPEC 3.5). Pure: same input, same verdict. An LLM may explain the reasons, never set them.
 * The verdict is the worst of the rules that fire; reasons list every rule that fired, worst first.
 */
export function checkGate(input: GateInput, policy: Policy = defaultPolicy): GateResult {
  const hits: { verdict: Verdict; reason: Reason }[] = [];
  const add = (verdict: Verdict, code: Reason['code'], detail: string) => {
    if (verdict !== 'GO') hits.push({ verdict, reason: { code, detail } });
  };
  // A price move against the taker: buyers pay more, sellers receive less.
  const adverse = (x: number) => (input.side === 'buy' ? x : -x);
  const against = input.side === 'buy' ? 'Paying' : 'Receiving';
  const dir = input.side === 'buy' ? 'over' : 'under';

  if (input.halted) add('BLOCK', 'VENUE_HALTED', 'Venue is halted (corporate action or issuer pause)');
  if (input.multiplierPending) add('CAUTION', 'MULTIPLIER_PENDING', 'A BEP-677 multiplier change is scheduled; balances and prices will rescale');

  if (input.referenceSep === null) {
    add('CAUTION', 'REF_MISSING', 'No reference price available');
  } else {
    if (input.marketState !== 'REGULAR' && input.referenceAgeSec > policy.referenceAgeSec.caution) {
      add('CAUTION', 'REF_STALE', `Reference price is ${formatDuration(input.referenceAgeSec)} old (US market ${input.marketState.toLowerCase()})`);
    }
    const premium = adverse(bps(input.executableSep, input.referenceSep));
    add(grade(premium, policy.premiumBps), 'PREMIUM_HIGH', `${against} ${fmtBps(premium)} ${dir} the last reference price`);
  }

  if (input.oracleSep !== null && input.oracleAgeSec !== null) {
    add(grade(input.oracleAgeSec, policy.oracleAgeSec), 'ORACLE_STALE', `Oracle last updated ${formatDuration(input.oracleAgeSec)} ago`);
    const divergence = Math.abs(bps(input.executableSep, input.oracleSep));
    add(grade(divergence, policy.oracleDivergenceBps), 'ORACLE_DIVERGENCE', `Executable price is ${fmtBps(divergence)} away from the oracle`);
  }

  if (input.executableSep100 !== null) {
    const impact = adverse(bps(input.executableSep, input.executableSep100));
    add(grade(impact, policy.impactBps), 'IMPACT_HIGH', `${fmtBps(impact)} of price impact at this size versus $100`);
  }

  hits.sort((a, b) => RANK[b.verdict] - RANK[a.verdict]);
  const verdict = hits.reduce<Verdict>((worst, h) => (RANK[h.verdict] > RANK[worst] ? h.verdict : worst), 'GO');
  return { verdict, reasons: hits.map((h) => h.reason), policy: policy.id };
}
