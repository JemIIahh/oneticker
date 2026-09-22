'use client';

import { useState } from 'react';
import type { VenueView } from '@/lib/fixtures';
import { usd } from '@/lib/format';
import { Verdict } from './Verdict';

/** Amount in, ranked venues out. The ranking is by price per share among venues that can quote; the gate shows next to each. */
export function RoutePanel({ ticker, venues }: { ticker: string; venues: VenueView[] }) {
  const [amount, setAmount] = useState(500);
  const quotable = venues.filter((v) => v.quote.ok && v.execSep !== null && v.gate).sort((a, b) => a.execSep! - b.execSep!);
  const excluded = venues.filter((v) => !v.quote.ok);
  const best = quotable[0];

  return (
    <section className="panel px-6 py-6">
      <span className="panel-tab">Route</span>
      <form className="flex flex-wrap items-end gap-x-6 gap-y-3" onSubmit={(e) => e.preventDefault()}>
        <label className="text-sm text-muted">
          Buy {ticker} for
          <span className="mt-1.5 flex items-center rounded-sm border border-rule-strong bg-canvas px-3">
            <span className="text-lg text-muted">$</span>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
              className="num w-32 bg-transparent py-2 pl-1 text-2xl text-ink outline-none"
              aria-label="Amount in US dollars"
            />
          </span>
        </label>
        <p className="max-w-sm pb-2 text-sm text-muted">Prices are the recorded $100 quotes; live quotes at your size arrive with the live data.</p>
      </form>

      <ol className="mt-6 divide-y divide-rule border-y border-rule">
        {quotable.map((v, i) => (
          <li key={v.issuer} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[1.5rem_8rem_1fr_auto_auto]">
            <span className="text-muted">{i + 1}</span>
            <span>
              <span className="font-semibold">{v.symbol}</span>
              <span className="ml-2 text-sm text-muted">{v.label}</span>
            </span>
            <span className="num col-span-3 text-muted sm:col-span-1 sm:text-right">
              <span className="text-ink">{usd(v.execSep)}</span> per share, about {v.execSep ? (amount / v.execSep).toFixed(4) : '—'} shares
            </span>
            <Verdict value={v.gate!.verdict} className="justify-self-end" />
          </li>
        ))}
        {quotable.length === 0 && <li className="py-3 text-muted">No venue can quote right now.</li>}
      </ol>

      {excluded.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {excluded.map((v) => (
            <li key={v.issuer}>
              <span className="text-ink">{v.symbol}</span> left out: {v.quote.ok ? '' : v.quote.reason.toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      {best && best.gate && (
        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <p className="text-lg">
              Best route is <span className="font-semibold">{best.symbol}</span> at <span className="num">{usd(best.execSep)}</span> per share.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted">{best.gate.reasons.length > 0 ? best.gate.reasons.map((r) => <li key={r.code}>{r.detail}</li>) : <li>Every check passed.</li>}</ul>
            <p className="mt-3 text-xs text-muted">The verdict is set by code from the numbers above, never by a model.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:w-44">
            <Verdict value={best.gate.verdict} className="text-center text-base" />
            <button type="button" disabled className="rounded-sm border border-rule-strong px-3 py-2 text-sm text-muted" title="Execution arrives with the wallet integration">
              {best.gate.verdict === 'BLOCK' ? 'Blocked' : 'Execute'}
            </button>
            <button type="button" disabled className="rounded-sm border border-rule-strong px-3 py-2 text-sm text-muted" title="Wait-for-GO intents arrive later">
              Wait for GO
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
