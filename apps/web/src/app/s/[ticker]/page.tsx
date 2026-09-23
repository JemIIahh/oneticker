import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PriceHistory } from '@/components/PriceHistory';
import { Router } from '@/components/Router';
import { getAllInstruments, listInstruments } from '@/lib/data';
import { getHistory, HISTORY_HOURS } from '@/lib/history';
import { bps, duration, usd } from '@/lib/format';
import type { VenueView } from '@/lib/view';

export function generateStaticParams() {
  return listInstruments().map((i) => ({ ticker: i.ticker }));
}

const ROWS: { name: string; hint: string; cell: (v: VenueView) => React.ReactNode }[] = [
  { name: 'You pay', hint: 'What a $100 order fills at', cell: (v) => (v.quote.ok ? `$${usd(v.execSep)}` : <span className="text-muted">{v.quote.reason}</span>) },
  { name: 'Last trade', hint: 'Latest on-chain price', cell: (v) => (v.onchainSep === null ? '—' : <>${usd(v.onchainSep)}{v.onchainAgeSec !== null && v.onchainAgeSec > 900 && <span className="ml-2 text-sm text-muted">{duration(v.onchainAgeSec)} old</span>}</>) },
  { name: 'Vs reference', hint: 'Premium over the reference price', cell: (v) => <span className={v.premiumBps !== null && v.premiumBps > 75 ? 'text-block' : ''}>{bps(v.premiumBps)}</span> },
  { name: 'Oracle', hint: 'APRO price feed on BNB Chain', cell: (v) => (v.oracle ? <>${usd(v.oracle.sep)}<span className="ml-2 text-sm text-muted">{duration(v.oracle.ageSec)} ago</span></> : <span className="text-muted">No feed</span>) },
  { name: 'Shares per token', hint: 'After dividends and splits', cell: (v) => (v.shareRatio === null ? <span className="text-muted">Unknown this run</span> : v.shareRatio.toFixed(6)) },
];

export default async function InstrumentPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const views = await getAllInstruments();
  const view = views.find((v) => v.ticker === ticker.toUpperCase());
  if (!view) notFound();
  const instrumentId = listInstruments().find((i) => i.ticker === view.ticker)!.id;
  const history = await getHistory(instrumentId);

  return (
    <div className="pt-10 sm:pt-14">
      <nav aria-label="Stocks" className="flex flex-wrap gap-2">
        {views.map((v) => (
          <Link
            key={v.ticker}
            href={`/s/${v.ticker}`}
            aria-current={v.ticker === view.ticker ? 'page' : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${v.ticker === view.ticker ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
          >
            {v.ticker}
          </Link>
        ))}
      </nav>

      <div className="mt-12">
        <Router key={view.ticker} views={[view]} initial={view.ticker} now={new Date().getTime()} lock />
      </div>

      <section className="mt-20" aria-labelledby="history">
        <h2 id="history" className="font-display text-3xl font-semibold tracking-[-0.025em]">
          The last {HISTORY_HOURS} hours, per share
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          While Wall Street is closed, the tokens keep trading. The shaded hours are when there is no real stock price to check them against; the 24/7 perp is the
          closest thing to one.
        </p>
        <div className="mt-8 rounded-3xl border border-line bg-surface p-5 sm:p-8">
          {history && history.points.length >= 2 ? (
            <PriceHistory history={history} />
          ) : (
            <p className="text-muted">
              {history
                ? 'The Tape has not recorded enough of this stock yet. The chart fills in as it runs, every five minutes.'
                : 'No price history here: this page is not connected to the Tape (the 5-minute price recorder).'}
            </p>
          )}
        </div>
      </section>

      <section className="mt-20" aria-labelledby="numbers">
        <h2 id="numbers" className="font-display text-3xl font-semibold tracking-[-0.025em]">
          The numbers, per share
        </h2>
        <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="px-6 py-5 font-normal text-muted sm:px-8">
                  <span className="sr-only">Measure</span>
                </th>
                {view.venues.map((v) => (
                  <th key={v.issuer} className="px-6 py-5 sm:px-8">
                    <span className="block font-display text-xl font-semibold">{v.label}</span>
                    <span className="text-sm font-normal text-muted">{v.symbol}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map((r) => (
                <tr key={r.name}>
                  <th scope="row" className="px-6 py-4 align-top font-normal sm:px-8">
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-sm text-muted">{r.hint}</span>
                  </th>
                  {view.venues.map((v) => (
                    <td key={v.issuer} className="px-6 py-4 align-top text-lg sm:px-8">
                      {r.cell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          Reference price{view.referenceSep !== null && ` $${usd(view.referenceSep)}`}: {view.referenceNote}.
        </p>
      </section>
    </div>
  );
}
