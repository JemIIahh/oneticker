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

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold">
            {view.ticker} <span className="ml-2 text-xl font-normal text-muted">{view.name}</span>
          </h1>
          <p className="mt-3 max-w-md text-lg">
            {STATE_SENTENCE[clock.state]}{' '}
            {closed ? (
              <>
                Last real price is <span className="font-semibold">{duration(clock.referenceAgeSec)}</span> old. Reopens {etTime(clock.nextOpen)} ET.
              </>
            ) : (
              <>Closes {etTime(clock.nextClose)} ET.</>
            )}
          </p>
          <p className="mt-2 text-sm text-muted">Prices recorded {new Date(view.asOf).toUTCString().replace(' GMT', ' UTC')}.</p>
        </div>
        <WeekClock clock={clock} at={now} />
      </div>

      <div className="mt-8">
        <VenueTable venues={view.venues} referenceSep={view.referenceSep} />
        <p className="mt-2 px-3 text-xs text-muted">Reference: {view.referenceNote}.</p>
      </div>

      <div className="mt-8">
        <RoutePanel ticker={view.ticker} venues={view.venues} />
      </div>
    </div>
  );
}
