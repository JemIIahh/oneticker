import { defaultPolicy } from '@oneticker/core';
import { GROUPS, SIZES, type Findings, type Group, type Quantiles } from './analysis';

const GROUP_LABEL: Record<Group, string> = { open: 'US open', weeknight: 'Weeknight (closed)', weekend: 'Weekend (closed)' };
const SIZE_LABEL = { '100': '$100', '1k': '$1,000', '10k': '$10,000' } as const;

const n0 = (x: number | null) => (x === null ? 'n/a' : Math.round(x).toLocaleString('en-US'));
const n1 = (x: number | null) => (x === null ? 'n/a' : x.toFixed(1));
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** bps as a percent of price. */
const pc = (x: number | null) => (x === null ? 'n/a' : `${(x / 100).toFixed(x >= 10_000 ? 0 : 1)}%`);
const q = (v: Quantiles, f: (x: number | null) => string = n1) => (v.n === 0 ? 'n/a' : `${f(v.p10)} / ${f(v.p50)} / ${f(v.p90)}`);
const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
const table = (head: string[], rows: string[][]) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

export interface ReportMeta {
  generatedAt: string;
  intervalSec: number;
  source: string;
}

export function renderReport(f: Findings, meta: ReportMeta): string {
  const hours = (Date.parse(f.window.to) - Date.parse(f.window.from)) / 3_600_000;
  const expectedRuns = Math.floor((hours * 3600) / meta.intervalSec) + 1;
  const policy = defaultPolicy;
  const out: string[] = [];
  out.push('# What the Tape saw (generated)');
  out.push('');
  out.push(`Generated ${meta.generatedAt} by \`pnpm --filter tape analyze\` from ${meta.source}. Do not edit by hand: rerun the script.`);
  out.push('');
  out.push('## Window and coverage');
  out.push('');
  out.push(
    `${f.window.from} to ${f.window.to} UTC (${hours.toFixed(0)} hours), ${f.window.samples.toLocaleString('en-US')} samples (one run times one instrument) across ${f.window.instruments} instruments. ` +
      `${f.window.runs} successful runs against about ${expectedRuns} possible at ${meta.intervalSec / 60}-minute spacing (${pct(f.window.runs / expectedRuns)}): the Tape ran on a laptop, so it slept, lost its VPN and fell behind the slot in places. Every figure below describes the samples that exist, not the whole window.`,
  );
  out.push('');
  out.push(
    table(
      ['Market', 'Samples', 'Perp', 'Pool', 'Oracle', 'Any $100 quote', 'xStocks $100 quote'],
      GROUPS.map((g) => {
        const c = f.coverage[g];
        return [GROUP_LABEL[g], String(c.samples), pct(c.perp / (c.samples || 1)), pct(c.pool / (c.samples || 1)), pct(c.oracle / (c.samples || 1)), pct(c.quote100 / (c.samples || 1)), pct(c.xstocksQuote100 / (c.samples || 1))];
      }),
    ),
  );
  out.push('');
  out.push('Columns show the share of samples that have that surface. Binance-sourced surfaces (perp, quotes) are missing whenever the laptop was outside an allowed country; the pool and oracle are read from BSC and are always available.');
  out.push('');
  out.push('## 1. Which issuer is cheaper, and what choosing wrong costs');
  out.push('');
  out.push('Samples where bStocks and Ondo both returned a buy quote. Regret is how much more a fixed choice charged per share than the cheaper of the two. xStocks never quoted, so always choosing it would have failed every time.');
  out.push('');
  out.push(
    table(
      ['Size', 'Market', 'Samples', 'bStocks cheapest', 'Always bStocks: mean / p90 regret', 'Always Ondo: median / p90 regret', 'Ondo over 10% worse'],
      SIZES.flatMap((z) =>
        GROUPS.map((g) => {
          const s = f.issuerSpread[z][g];
          if (s.n === 0) return [SIZE_LABEL[z], GROUP_LABEL[g], '0', 'n/a', 'n/a', 'n/a', 'n/a'];
          return [SIZE_LABEL[z], GROUP_LABEL[g], String(s.n), pct(s.bstocksCheapest), `${n1(s.regretBstocks.mean)} / ${n1(s.regretBstocks.p90)} bps`, `${pc(s.regretOndo.p50)} / ${pc(s.regretOndo.p90)}`, pct(s.ondoOver10pct)];
        }),
      ),
    ),
  );
  out.push('');
  out.push('## 2. On-chain pool against the 24/7 perp');
  out.push('');
  out.push(`bStocks pool price per share against the Binance TradFi perp mark, in bps (p10 / p50 / p90). Negative means the pool is below the perp. "Beyond cap" is the share of samples farther than ${policy.premiumBps.caution} bps either way, the gate's premium caution level.`);
  out.push('');
  out.push(table(['Market', 'Samples', 'Pool vs perp (bps)', 'Largest gap (bps)', 'Beyond cap'], GROUPS.map((g) => [GROUP_LABEL[g], String(f.poolVsPerp[g].n), q(f.poolVsPerp[g]), n0(f.poolVsPerp[g].maxAbs), f.poolVsPerp[g].n ? pct(f.poolVsPerp[g].beyondPremiumCaution) : 'n/a'])));
  out.push('');
  out.push(table(['Instrument', ...GROUPS.map((g) => GROUP_LABEL[g] + ' (p10 / p50 / p90)')], Object.entries(f.poolVsPerpByInstrument).map(([k, v]) => [k, ...GROUPS.map((g) => q(v[g]))])));
  out.push('');
  out.push('## 3. The oracle');
  out.push('');
  out.push(`APRO feed per share against the perp, in bps, and how old the feed's last update was. The gate cautions beyond ${policy.oracleDivergenceBps.caution} bps and blocks beyond ${policy.oracleDivergenceBps.block}; it cautions when the feed is older than ${policy.oracleAgeSec.caution / 60} minutes and blocks beyond ${(policy.oracleAgeSec.block ?? 0) / 60}. MSTR has no feed.`);
  out.push('');
  out.push(table(['Market', 'Samples', 'Oracle vs perp (bps)', 'Largest gap (bps)', 'Beyond caution', 'Beyond block', 'Feed age, minutes'], GROUPS.map((g) => [GROUP_LABEL[g], String(f.oracleVsPerp[g].n), q(f.oracleVsPerp[g]), n0(f.oracleVsPerp[g].maxAbs), f.oracleVsPerp[g].n ? pct(f.oracleVsPerp[g].beyondCaution) : 'n/a', f.oracleVsPerp[g].n ? pct(f.oracleVsPerp[g].beyondBlock) : 'n/a', q(f.oracleAgeMin[g], n0)])));
  out.push('');
  out.push('## 4. The gate, replayed');
  out.push('');
  const closedN = f.gateReplay.weeknight.n + f.gateReplay.weekend.n;
  const closedPerp = (f.gateReplay.weeknight.reasons.PERP_DIVERGENCE ?? 0) + (f.gateReplay.weekend.reasons.PERP_DIVERGENCE ?? 0);
  out.push(
    `The shipped gate (\`${policy.id}\`) run over the cheapest $1,000 route in each sample, with the inputs the router uses: Binance's derived reference, the market clock's reference age and, while the US market is closed, the live 24/7 perp as a cross-check. ` +
      `The reference-age rule needs no price at all: it fires on ${pct(f.refStaleShareClosed)} of closed-market samples (more than ${policy.referenceAgeSec.caution / 60} minutes since the last close), so the verdict is CAUTION for nearly every closed hour. ` +
      `The perp rule is what makes that CAUTION informative: it fired on ${closedN === 0 ? 'n/a' : pct(closedPerp / closedN)} of closed-hour samples (${closedPerp} of ${closedN}), and when it does not fire the stale-reference reason now says how far the price sits from the perp.`,
  );
  out.push('');
  out.push(table(['Market', 'Samples', 'GO', 'CAUTION', 'BLOCK', 'Reasons that fired'], GROUPS.map((g) => {
    const r = f.gateReplay[g];
    const reasons = Object.entries(r.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / (r.n || 1))}`).join(', ');
    return [GROUP_LABEL[g], String(r.n), pct(r.verdicts.GO / (r.n || 1)), pct(r.verdicts.CAUTION / (r.n || 1)), pct(r.verdicts.BLOCK / (r.n || 1)), reasons || 'none'];
  })));
  out.push('');
  out.push('## Method and limits');
  out.push('');
  out.push('- A sample is one Tape run for one instrument. Prices are per share: token price divided by the venue\'s shares-per-token ratio.');
  out.push('- The perp is a yardstick, not truth. The Tape has no equity reference (Finnhub is pending) and a perp has its own basis and funding.');
  out.push('- "Weekend" means closed with more than 48 hours between the last close and the next open. "Weeknight" is every other closed hour. Both come from the market clock in `packages/core`.');
  out.push('- Quotes are what the Binance aggregator returned; no trade was executed. Ondo size quotes in particular route through thin pools and can be many times the $100 price.');
  out.push('- Coverage is uneven and the sample is a few days. Treat these as a first look, not a distribution.');
  out.push('');
  return out.join('\n');
}
