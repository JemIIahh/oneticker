import { Router } from '@/components/Router';
import { StockList } from '@/components/StockList';
import { WeekStrip } from '@/components/WeekStrip';
import { getAllInstruments } from '@/lib/data';

export default async function Home() {
  const views = await getAllInstruments();

  return (
    <div className="pt-16 sm:pt-24">
      <Router views={views} initial="NVDA" now={new Date().getTime()} />

      <section className="mt-24" aria-labelledby="week">
        <h2 id="week" className="max-w-2xl font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
          Wall Street trades 32½ hours a week. The tokens trade all 168.
        </h2>
        <WeekStrip at={new Date()} className="mt-8" />
      </section>

      <section id="stocks" className="mt-24 scroll-mt-8" aria-labelledby="stocks-h">
        <h2 id="stocks-h" className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
          Five stocks, three issuers each
        </h2>
        <StockList views={views} className="mt-8" />
      </section>
    </div>
  );
}
