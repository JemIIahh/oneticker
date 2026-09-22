'use client';

import { useState } from 'react';
import type { VenueView } from '@/lib/fixtures';
import { usd } from '@/lib/format';
import { Verdict } from './Verdict';

const RANK: Record<string, number> = { GO: 0, CAUTION: 1, BLOCK: 2 };

/** Amount in, ranked venues out. The ranking is by price per share among venues that can quote; the gate shows next to each. */
export function RoutePanel({ ticker, venues }: { ticker: string; venues: VenueView[] }) {
  const [amount, setAmount] = useState(500);
  const quotable = venues.filter((v) => v.quote.ok && v.execSep !== null && v.gate).sort((a, b) => a.execSep! - b.execSep!);
  const excluded = venues.filter((v) => !v.quote.ok);
  const best = quotable[0];

  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="text-sm text-muted">
          Buy {ticker} for
          <span className="mt-1 flex items-center rounded-sm border border-line bg-ink px-2">
            <span className="text-muted">$</span>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
              className="w-28 bg-transparent py-1.5 pl-1 text-lg text-paper outline-none"
              aria-label="Amount in US dollars"
            />
          </span>
        </label>
        <p className="text-sm text-muted">Quotes below are the recorded $100 quotes; live quotes at your size arrive with the live data.</p>
      </form>

      <ol className="mt-5 space-y-2">
        {quotable.map((v, i) => (
          <li key={v.issuer} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-sm border border-line px-3 py-2">
            <span className="w-5 text-muted">{i + 1}</span>
            <span className="font-semibold">{v.symbol}</span>
            <span className="text-muted">{v.label}</span>
            <span className="ml-auto">{usd(v.execSep)} per share</span>
            <span className="text-muted">
              about {v.execSep ? (amount / v.execSep).toFixed(4) : '—'} shares
            </span>
            <Verdict value={v.gate!.verdict} />
          </li>
        ))}
        {quotable.length === 0 && <li className="text-muted">No venue can quote right now.</li>}
      </ol>

      {excluded.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {excluded.map((v) => (
            <li key={v.issuer}>
              {v.symbol}: {v.quote.ok ? '' : v.quote.reason}
            </li>
          ))}
        </ul>
      )}

      {best && best.gate && (
        <div className="mt-5 border-t border-line pt-4">
          <p>
            Best route: <span className="font-semibold">{best.symbol}</span> at {usd(best.execSep)} per share. <Verdict value={best.gate.verdict} className="ml-1" />
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted">{best.gate.reasons.length > 0 ? best.gate.reasons.map((r) => <li key={r.code}>{r.detail}</li>) : <li>Every check passed.</li>}</ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled className="rounded-sm border border-line px-3 py-1.5 text-sm text-muted" title="Execution arrives with the wallet integration">
              {best.gate.verdict === 'BLOCK' ? 'Blocked' : 'Execute'}
            </button>
            <button type="button" disabled className="rounded-sm border border-line px-3 py-1.5 text-sm text-muted" title="Wait-for-GO intents arrive later">
              Wait for GO
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">The verdict is set by code from the numbers above; nothing here is generated.</p>
        </div>
      )}
    </section>
  );
}
