import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RoutePanel } from '@/components/RoutePanel';
import { VenueTable } from '@/components/VenueTable';
import { WeekClock } from '@/components/WeekClock';
import { listInstruments, loadInstrument } from '@/lib/fixtures';
import { duration, etTime } from '@/lib/format';

export function generateStaticParams() {
  return listInstruments().map((i) => ({ ticker: i.ticker }));
}

const STATE_SENTENCE: Record<string, string> = {
  REGULAR: 'Wall Street is open.',
  PRE: 'Pre-market.',
  POST: 'After hours.',
  OVERNIGHT: 'Overnight.',
  WEEKEND: 'Weekend.',
  HOLIDAY: 'Market holiday.',
  HALTED: 'Halted.',
};

export default async function InstrumentPage({ params, searchParams }: { params: Promise<{ ticker: string }>; searchParams: Promise<{ at?: string }> }) {
  const { ticker } = await params;
  const { at } = await searchParams;
  const atDate = at && !Number.isNaN(Date.parse(at)) ? new Date(at) : undefined;
  const view = loadInstrument(ticker, atDate);
  if (!view) notFound();

  const now = atDate ?? new Date(view.asOf);
  const { clock } = view;
  const closed = clock.state !== 'REGULAR';
  const others = listInstruments().filter((i) => i.ticker !== view.ticker);

  return (
    <div className="py-10">
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="text-sm text-muted">
            {others.map((i) => (
              <Link key={i.ticker} href={`/s/${i.ticker}`} className="mr-4 hover:text-ink">
                {i.ticker}
              </Link>
            ))}
          </p>
          <h1 className="mt-3 text-6xl font-semibold tracking-tight">
            {view.ticker}
            <span className="ml-4 text-2xl font-normal text-muted">{view.name}</span>
          </h1>
          <p className="mt-5 max-w-lg text-xl leading-snug">
            {STATE_SENTENCE[clock.state]}{' '}
            {closed ? (
              <>
                The last real price is <span className="font-semibold">{duration(clock.referenceAgeSec)}</span> old. Wall Street reopens {etTime(clock.nextOpen)} ET.
              </>
            ) : (
              <>Closes {etTime(clock.nextClose)} ET.</>
            )}
          </p>
          <p className="mt-3 text-sm text-muted">Prices recorded {new Date(view.asOf).toUTCString().replace(' GMT', ' UTC')}.</p>
        </div>
        <WeekClock clock={clock} at={now} />
      </div>

      <div className="mt-12">
        <VenueTable venues={view.venues} referenceSep={view.referenceSep} />
        <p className="mt-3 px-1 text-xs text-muted">Reference: {view.referenceNote}.</p>
      </div>

      <div className="mt-12">
        <RoutePanel ticker={view.ticker} venues={view.venues} />
      </div>
    </div>
  );
}
