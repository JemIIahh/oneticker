'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { InstrumentView } from '@/lib/view';
import { duration, usd } from '@/lib/format';
import { Verdict, VerdictDisc, VERDICT_TEXT } from './Verdict';

/**
 * The product in one sentence: "Buy NVDA with $500", answered with the best token, its price per share and the
 * gate's signal. Ranked by price per share among issuers that can fill; the others sit beside it.
 */
export function Router({ views, initial, now, lock = false }: { views: InstrumentView[]; initial: string; now: number; lock?: boolean }) {
  const [ticker, setTicker] = useState(initial);
  const [amount, setAmount] = useState(500);
  const view = views.find((v) => v.ticker === ticker) ?? views[0];

  const quotable = view.venues.filter((v) => v.quote.ok && v.execSep !== null && v.gate).sort((a, b) => a.execSep! - b.execSep!);
  const excluded = view.venues.filter((v) => !v.quote.ok);
  const best = quotable[0];
  const ageSec = Math.max(0, Math.floor((now - Date.parse(view.asOf)) / 1000));

  return (
    <section aria-label="Find the best route">
      <form className="font-display text-[clamp(2.4rem,7vw,5rem)] font-semibold leading-[1.05] tracking-[-0.035em]" onSubmit={(e) => e.preventDefault()}>
        <span className="text-muted">Buy </span>
        {lock ? (
          <span>{view.ticker}</span>
        ) : (
          <label className="relative inline-block">
            <span className="sr-only">Stock</span>
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="cursor-pointer appearance-none rounded-2xl border border-line bg-surface py-1 pr-[0.9em] pl-[0.3em] text-ink transition hover:border-muted"
            >
              {views.map((v) => (
                <option key={v.ticker} value={v.ticker}>
                  {v.ticker}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 12 8" className="pointer-events-none absolute top-1/2 right-[0.3em] h-[0.18em] w-[0.28em] -translate-y-1/2 fill-none stroke-muted" strokeWidth="2" aria-hidden="true">
              <path d="M1 1.5 6 6.5 11 1.5" />
            </svg>
          </label>
        )}
        <span className="text-muted"> with </span>
        <label className="inline-flex items-baseline rounded-2xl border border-line bg-surface py-1 pr-[0.3em] pl-[0.3em] transition focus-within:border-muted hover:border-muted">
          <span className="text-muted">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="fit bg-transparent text-ink outline-none"
            style={{ width: `${Math.max(1, String(amount).length)}ch` }}
            aria-label="Amount in US dollars"
          />
        </label>
      </form>

      <p className="mt-4 text-muted">{view.name}. Three issuers sell it as a token on BNB Chain; here is the one to buy.</p>

      <div key={`${view.ticker}`} className="settle mt-10 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {best && best.gate ? (
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-5">
              <VerdictDisc value={best.gate.verdict} className="h-12 w-12" />
              <div>
                <p className="font-display text-3xl font-semibold tracking-[-0.02em]">{VERDICT_TEXT[best.gate.verdict].word}</p>
                <p className="text-sm text-muted">{VERDICT_TEXT[best.gate.verdict].meaning}</p>
              </div>
            </div>

            <p className="mt-8 text-muted">Best route</p>
            <p className="font-display text-4xl font-semibold tracking-[-0.03em]">
              {best.symbol}
              <span className="ml-3 font-sans text-lg font-normal tracking-normal text-muted">on {best.label}</span>
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6">
              <div>
                <dt className="text-sm text-muted">Price per share</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">${usd(best.execSep)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">You get</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">{amount > 0 ? (amount / best.execSep!).toFixed(4) : '0'} shares</dd>
              </div>
            </dl>

            {best.gate.reasons.length > 0 && (
              <ul className="mt-6 space-y-2 rounded-2xl bg-raised p-4 text-sm">
                {best.gate.reasons.map((r) => (
                  <li key={r.code} className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                    {r.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-line bg-surface p-8">
            <p className="font-display text-3xl font-semibold">No route right now</p>
            <p className="mt-2 text-muted">None of the three issuers can fill this order. Try again when Wall Street opens.</p>
          </div>
        )}

        <div className="rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
          <p className="text-muted">All three issuers, per share</p>
          <ul className="mt-4 divide-y divide-line">
            {quotable.map((v, i) => (
              <li key={v.issuer} className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{v.label}</p>
                  <p className="text-sm text-muted">{v.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold">${usd(v.execSep)}</p>
                  <p className="text-sm text-muted">{i === 0 ? 'Cheapest' : `+$${usd(v.execSep! - best!.execSep!)}`}</p>
                </div>
                <Verdict value={v.gate!.verdict} className="w-[6.5rem] justify-center" />
              </li>
            ))}
            {excluded.map((v) => (
              <li key={v.issuer} className="flex items-center gap-4 py-4 text-muted">
                <div className="shrink-0">
                  <p className="font-medium">{v.label}</p>
                  <p className="text-sm">{v.symbol}</p>
                </div>
                <p className="min-w-0 flex-1 text-right text-sm">{v.quote.ok ? '' : v.quote.reason}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-faint">
            Quotes from {duration(ageSec)} ago. Checked by code, never by a model.
          </p>
          {!lock && (
            <Link href={`/s/${view.ticker}`} className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-85">
              Compare {view.ticker} in detail
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
