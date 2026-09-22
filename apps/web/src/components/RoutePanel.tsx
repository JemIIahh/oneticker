'use client';

import { useState } from 'react';
import type { VenueView } from '@/lib/view';
import { usd } from '@/lib/format';
import { button, buttonQuiet, card, label, row } from '@/lib/ui';
import { Verdict } from './Verdict';

/** Amount in, ranked venues out. The ranking is by price per share among venues that can quote; the gate shows next to each. */
export function RoutePanel({ ticker, venues }: { ticker: string; venues: VenueView[] }) {
  const [amount, setAmount] = useState(500);
  const quotable = venues.filter((v) => v.quote.ok && v.execSep !== null && v.gate).sort((a, b) => a.execSep! - b.execSep!);
  const excluded = venues.filter((v) => !v.quote.ok);
  const best = quotable[0];

  return (
    <section className={`rise [animation-delay:420ms] ${card}`}>
      <p className={label}>Route</p>
      <form className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3" onSubmit={(e) => e.preventDefault()}>
        <label className="block">
          <span className="text-sm text-graphite">Buy {ticker} for</span>
          <span className="mt-2 flex items-center rounded-xl border border-black/12 bg-white/70 px-4">
            <span className="font-mono text-lg text-graphite">$</span>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
              className="w-32 bg-transparent py-2.5 pl-1 font-mono text-2xl text-ink outline-none"
              aria-label="Amount in US dollars"
            />
          </span>
        </label>
        <p className="max-w-sm pb-2 text-sm text-graphite">Prices are the recorded $100 quotes; live quotes at your size arrive with the live data.</p>
      </form>

      <ol className="mt-6 space-y-2">
        {quotable.map((v, i) => (
          <li key={v.issuer} className={`${row} grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[1.5rem_9rem_1fr_auto]`}>
            <span className="font-mono text-[11px] text-graphite">{i + 1}</span>
            <span>
              <span className="font-mono font-medium">{v.symbol}</span>
              <span className="ml-2 text-sm text-graphite">{v.label}</span>
            </span>
            <span className="col-span-3 text-sm text-graphite sm:col-span-1 sm:text-right">
              <span className="font-mono text-ink">{usd(v.execSep)}</span> per share, about <span className="font-mono">{v.execSep ? (amount / v.execSep).toFixed(4) : '—'}</span> shares
            </span>
            <Verdict value={v.gate!.verdict} className="justify-self-end" />
          </li>
        ))}
        {quotable.length === 0 && <li className={`${row} text-sm text-graphite`}>No venue can quote right now.</li>}
      </ol>

      {excluded.length > 0 && (
        <ul className="mt-3 space-y-1 px-4 text-sm text-graphite">
          {excluded.map((v) => (
            <li key={v.issuer}>
              <span className="font-mono text-ink">{v.symbol}</span> left out: {v.quote.ok ? '' : v.quote.reason.toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      {best && best.gate && (
        <div className="mt-7 grid gap-5 border-t border-black/10 pt-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <p className="text-lg">
              Best route is <span className="font-mono font-medium">{best.symbol}</span> at <span className="font-mono">{usd(best.execSep)}</span> per share.{' '}
              <Verdict value={best.gate.verdict} className="ml-1 align-middle" />
            </p>
            <ul className="mt-2 space-y-1 text-sm text-graphite">{best.gate.reasons.length > 0 ? best.gate.reasons.map((r) => <li key={r.code}>{r.detail}</li>) : <li>Every check passed.</li>}</ul>
            <p className="mt-3 font-mono text-[11px] text-graphite">The verdict is set by code from the numbers above, never by a model.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <button type="button" disabled className={button} title="Execution arrives with the wallet integration">
              {best.gate.verdict === 'BLOCK' ? 'Blocked' : 'Execute →'}
            </button>
            <button type="button" disabled className={buttonQuiet} title="Wait-for-GO intents arrive later">
              Wait for GO
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
