import Link from 'next/link';
import { listInstruments } from '@/lib/fixtures';

export default function Home() {
  return (
    <div className="py-10">
      <h1 className="max-w-2xl text-3xl font-semibold leading-tight">One ticker in. The safest fill out, even when Wall Street is closed.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Every US stock on BNB Chain exists as three tokens from three issuers. OneTicker compares them per share, tells you which ones you can buy right now, and says whether now is a
        safe moment.
      </p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listInstruments().map((i) => (
          <li key={i.id}>
            <Link href={`/s/${i.ticker}`} className="block rounded-md border border-line bg-panel px-4 py-3 hover:border-muted">
              <span className="text-lg font-semibold">{i.ticker}</span>
              <span className="ml-3 text-muted">{i.name}</span>
              <span className="mt-1 block text-sm text-muted">{i.venues.map((v) => v.symbol).join(', ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
