import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import Link from 'next/link';
import { marketClock } from '@oneticker/core';
import { MarketStatus } from '@/components/MarketStatus';
import { NavLinks } from '@/components/NavLinks';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display-face' });
const body = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

// The theme and market status follow the clock, so re-render at least every minute even on fixtures.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'OneTicker',
  description: 'The best way to buy a US stock on BNB Chain, right now, and whether now is safe.',
};

/** Three issuers, one answer: the mark is three dots with the chosen one lit. */
function Mark() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-ink" />
      <circle cx="8" cy="14" r="2.4" className="fill-bg opacity-40" />
      <circle cx="14" cy="14" r="3.4" className="fill-go" />
      <circle cx="20" cy="14" r="2.4" className="fill-bg opacity-40" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clock = marketClock(new Date());
  const theme = clock.state === 'REGULAR' ? 'day' : 'night';

  return (
    <html lang="en" data-theme={theme} className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="sky" aria-hidden="true" />
        <header className="sticky top-0 z-20 border-b border-line bg-bg/75 backdrop-blur-md">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:h-16 sm:py-0 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 justify-self-start font-display text-lg font-semibold tracking-[-0.02em]">
              <Mark />
              OneTicker
            </Link>
            <NavLinks className="hidden sm:flex" />
            <MarketStatus clock={clock} className="justify-self-end" />
            <NavLinks className="col-span-2 justify-self-start sm:hidden" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-faint sm:px-6">Research software, not investment advice. Tokenized stocks are not available to US persons.</footer>
      </body>
    </html>
  );
}
