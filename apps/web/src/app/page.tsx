import Link from 'next/link';
import { weekHour } from '@/components/LitHours';
import { Verdict } from '@/components/Verdict';
import { WeekRingPanel } from '@/components/WeekRingPanel';
import { listInstruments, loadInstrument } from '@/lib/fixtures';
import { duration, usd } from '@/lib/format';

export default function Home() {
  const now = new Date();
  const rows = listInstruments().map((i) => loadInstrument(i.ticker, now)!);
  const clock = rows[0]?.clock;

  return (
    <div className="py-12">
      <section className="grid items-start gap-10 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight">One ticker in. The safest fill out, even when Wall Street is closed.</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Every US stock on BNB Chain exists as three tokens from three issuers. OneTicker compares them per share, tells you which ones you can buy right now, and says
            whether now is a safe moment.
          </p>
          {clock && (
            <p className="mt-6 text-ink">
              {clock.state === 'REGULAR' ? 'Wall Street is open right now.' : `Wall Street has been closed for ${duration(clock.referenceAgeSec)}.`}{' '}
              <span className="text-muted">Tokens trade through all 168 hours; the lit ones are the 32.5 with a real price.</span>
            </p>
          )}
        </div>
        <div className="panel w-full px-4 py-4 md:w-[440px]">
          <span className="panel-tab">This week, hour by hour</span>
          <WeekRingPanel nowHour={weekHour(now) ?? 0} />
          <p className="px-2 pb-1 text-xs text-muted">168 bars, one per hour. The tall amber ones are when Wall Street trades; the dark one is now.</p>
        </div>
      </section>

      <section className="panel mt-14">
        <span className="panel-tab">Five stocks, three issuers each</span>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-muted">
              <th className="px-6 pb-2 pt-6 font-medium">Stock</th>
              <th className="px-3 pb-2 pt-6 font-medium">Cheapest per share</th>
              <th className="px-3 pb-2 pt-6 font-medium">Can buy now</th>
              <th className="px-3 pb-2 pt-6 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const quotable = r.venues.filter((v) => v.quote.ok && v.execSep !== null).sort((a, b) => a.execSep! - b.execSep!);
              const best = quotable[0];
              return (
                <tr key={r.ticker} className="border-t border-rule">
                  <td className="px-6 py-4">
                    <Link href={`/s/${r.ticker}`} className="group">
                      <span className="text-2xl font-semibold group-hover:text-lit">{r.ticker}</span>
                      <span className="ml-3 text-muted">{r.name}</span>
                    </Link>
                  </td>
                  <td className="num px-3 py-4">
                    {best ? (
                      <>
                        <span className="text-xl">{usd(best.execSep)}</span>
                        <span className="ml-2 text-sm text-muted">{best.symbol}</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm">
                    {quotable.length} of {r.venues.length}
                    <span className="ml-2 text-muted">{quotable.map((v) => v.label).join(', ') || 'none'}</span>
                  </td>
                  <td className="px-3 py-4">{best?.gate ? <Verdict value={best.gate.verdict} /> : <span className="text-sm text-muted">no route</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-rule px-6 py-3 text-xs text-muted">Prices recorded {new Date(rows[0]?.asOf ?? now).toUTCString().replace(' GMT', ' UTC')}. Live prices arrive with the Tape.</p>
      </section>
    </div>
  );
}
