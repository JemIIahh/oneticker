import Link from 'next/link';
import type { InstrumentView } from '@/lib/view';
import { usd } from '@/lib/format';
import { Verdict } from './Verdict';

/** Every covered stock in one row: which issuers can fill it (lit dots), the best price per share, and the signal. */
export function StockList({ views, className = '' }: { views: InstrumentView[]; className?: string }) {
  return (
    <ul className={`divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface ${className}`}>
      {views.map((r) => {
        const quotable = r.venues.filter((v) => v.quote.ok && v.execSep !== null).sort((a, b) => a.execSep! - b.execSep!);
        const best = quotable[0];
        return (
          <li key={r.ticker}>
            <Link href={`/s/${r.ticker}`} className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-5 py-5 transition hover:bg-raised sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_6rem] sm:px-8">
              <span className="min-w-0">
                <span className="font-display text-2xl font-semibold tracking-[-0.02em]">{r.ticker}</span>
                <span className="ml-3 truncate text-sm text-muted">{r.name}</span>
              </span>
              <span className="order-last col-span-2 flex items-center gap-2 text-sm text-muted sm:order-none sm:col-span-1" title={`${quotable.length} of ${r.venues.length} issuers can fill an order`}>
                {r.venues.map((v) => (
                  <span key={v.issuer} className={`h-2 w-2 rounded-full ${v.quote.ok ? 'bg-ink' : 'border border-faint'}`} aria-hidden="true" />
                ))}
                <span className="ml-1">{quotable.length} of {r.venues.length} can fill</span>
              </span>
              <span className="hidden sm:block">
                {best ? (
                  <>
                    <span className="font-display text-lg font-semibold">${usd(best.execSep)}</span>
                    <span className="ml-2 text-sm text-muted">{best.label}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">No quote</span>
                )}
              </span>
              <span className="justify-self-end">{best?.gate ? <Verdict value={best.gate.verdict} /> : <span className="text-sm text-muted">No route</span>}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
