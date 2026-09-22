import Link from 'next/link';
import { weekHour } from '@/components/LitHours';
import { Verdict } from '@/components/Verdict';
import { WeekRingPanel } from '@/components/WeekRingPanel';
import { listInstruments, loadInstrument } from '@/lib/fixtures';
import { duration, usd } from '@/lib/format';
import { card, label, row } from '@/lib/ui';

export default function Home() {
  const now = new Date();
  const rows = listInstruments().map((i) => loadInstrument(i.ticker, now)!);
  const clock = rows[0]?.clock;

  return (
    <div className="py-14">
      <section className="grid items-start gap-10 md:grid-cols-[1fr_auto]">
        <div className="rise max-w-xl">
          <p className={`flex items-center gap-3 ${label}`}>
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-ink" />
            {clock && (clock.state === 'REGULAR' ? 'Wall Street open' : `Wall Street closed ${duration(clock.referenceAgeSec)}`)}
          </p>
          <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em]">One ticker in. The safest fill out, even when Wall Street is closed.</h1>
          <p className="mt-6 text-lg leading-relaxed text-graphite">
            Every US stock on BNB Chain exists as three tokens from three issuers. OneTicker compares them per share, tells you which ones you can buy right now, and says
            whether now is a safe moment.
          </p>
        </div>
        <div className={`rise [animation-delay:220ms] ${card} w-full md:w-[440px]`}>
          <p className={label}>This week, hour by hour</p>
          <WeekRingPanel nowHour={weekHour(now) ?? 0} />
          <p className="mt-2 text-sm text-graphite">168 bars, one per hour. The tall ones are when Wall Street trades; the red one is now.</p>
        </div>
      </section>

      <section className={`rise [animation-delay:320ms] ${card} mt-12`}>
        <p className={label}>Five stocks, three issuers each</p>
        <ol className="mt-5 space-y-2">
          {rows.map((r) => {
            const quotable = r.venues.filter((v) => v.quote.ok && v.execSep !== null).sort((a, b) => a.execSep! - b.execSep!);
            const best = quotable[0];
            return (
              <li key={r.ticker}>
                <Link href={`/s/${r.ticker}`} className={`${row} grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 transition hover:bg-black/[0.06] sm:grid-cols-[9rem_1fr_auto_auto]`}>
                  <span>
                    <span className="text-xl font-semibold tracking-[-0.02em]">{r.ticker}</span>
                    <span className="ml-3 text-sm text-graphite">{r.name}</span>
                  </span>
                  <span className="col-span-2 text-sm text-graphite sm:col-span-1">
                    {best ? (
                      <>
                        <span className="font-mono text-ink">{usd(best.execSep)}</span> per share on {best.label}
                      </>
                    ) : (
                      'no quote'
                    )}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-graphite">
                    {quotable.length} of {r.venues.length} buyable
                  </span>
                  {best?.gate ? <Verdict value={best.gate.verdict} className="justify-self-end" /> : <span className="justify-self-end font-mono text-[11px] text-graphite">no route</span>}
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 font-mono text-[11px] text-graphite">Prices recorded {new Date(rows[0]?.asOf ?? now).toUTCString().replace(' GMT', ' UTC')}. Live prices arrive with the Tape.</p>
      </section>
    </div>
  );
}
