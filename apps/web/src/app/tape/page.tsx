import Link from 'next/link';
import { PriceHistory } from '@/components/PriceHistory';
import { WeekStrip } from '@/components/WeekStrip';
import { listInstruments } from '@/lib/data';
import { possibleRuns, recordedHistory, tape } from '@/lib/tape';

const FINDINGS_URL = 'https://github.com/JemIIahh/oneticker/blob/main/docs/tape-findings.md';
const pct = (x: number) => `${Math.round(x * 100)}%`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function TapePage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const all = listInstruments();
  const current = all.find((i) => i.ticker === s?.toUpperCase()) ?? all[0]!;
  const history = recordedHistory(current.id);

  const weekendGap = tape.poolVsPerp.weekend.maxAbs;
  const openGap = tape.poolVsPerp.open.maxAbs;
  const ondoWorse = tape.issuerSpread['1k'].weekend;
  const xstocks = Object.values(tape.coverage).reduce((n, c) => n + c.xstocksQuote100, 0);

  const cards = [
    { big: weekendGap === null ? '—' : `${Math.round(weekendGap)} bps`, text: 'Largest gap between the on-chain pool and the 24/7 perp in any weekend sample.', note: openGap === null ? undefined : `At the open: ${Math.round(openGap)} bps` },
    { big: pct(ondoWorse.ondoOver10pct), text: 'Of weekend $1,000 quotes had Ondo more than 10% above bStocks.', note: `bStocks was cheaper ${pct(ondoWorse.bstocksCheapest)} of the time` },
    { big: String(xstocks), text: 'xStocks quotes returned in this window. No liquidity from any vendor.', note: 'Excluded with the real error, 40374' },
    { big: pct(tape.refStaleShareClosed), text: 'Of closed-hour samples are CAUTION from the clock alone, before the gate looks at a price.', note: 'Each now says how far the price is from the 24/7 perp' },
  ];

  return (
    <div className="pt-16 sm:pt-24">
      <p className="flex items-center gap-2.5 text-sm text-muted">
        <span className="pulse h-2 w-2 rounded-full bg-go" aria-hidden="true" />
        {day(tape.window.from)} to {day(tape.window.to)}, including one weekend
      </p>
      <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
        {weekendGap === null ? 'What do the tokens do while Wall Street sleeps?' : `In every weekend sample, the pool was within ${Math.round(weekendGap)} bps of the perp.`}
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted">
        The risk was not a premium. It was picking the wrong issuer: at $1,000, Ondo was more than 10% above bStocks in {pct(ondoWorse.ondoOver10pct)} of weekend samples.
      </p>

      <nav aria-label="Stocks" className="mt-12 flex flex-wrap gap-2">
        {all.map((i) => (
          <Link
            key={i.id}
            href={`/tape?s=${i.ticker}`}
            aria-current={i.id === current.id ? 'page' : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${i.id === current.id ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
          >
            {i.ticker}
          </Link>
        ))}
      </nav>

      <div className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-8">
        {history ? <PriceHistory history={history} /> : <p className="text-muted">No recorded history for this stock.</p>}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.text} className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <p className="font-display text-5xl font-semibold tracking-[-0.03em]">{c.big}</p>
            <p className="mt-3 text-muted">{c.text}</p>
            {c.note && <p className="mt-2 text-sm text-faint">{c.note}</p>}
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-sm text-muted">
        {tape.window.samples.toLocaleString('en-US')} samples across {tape.window.instruments} stocks. The Tape ran on a laptop and caught {pct(tape.window.runs / possibleRuns())} of the runs the window could hold, so these are a first look, not a distribution.{' '}
        <a className="underline underline-offset-4 hover:text-ink" href={FINDINGS_URL}>
          Method and every number
        </a>
        .
      </p>

      <WeekStrip at={new Date()} className="mt-16" />
    </div>
  );
}
