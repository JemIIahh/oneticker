import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import Link from 'next/link';
import { LitHoursBand } from '@/components/LitHours';
import './globals.css';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });

export const metadata: Metadata = {
  title: 'OneTicker',
  description: 'One ticker in. The safest fill out, even when Wall Street is closed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body className="min-h-dvh">
        <header>
          <nav className="mx-auto flex max-w-6xl items-baseline gap-7 px-5 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              OneTicker
            </Link>
            <Link href="/tape" className="text-sm text-muted hover:text-ink">
              The Tape
            </Link>
            <span className="ml-auto text-sm text-muted">Tokenized US stocks on BNB Chain</span>
          </nav>
          <div className="mx-auto max-w-6xl px-5">
            <LitHoursBand at={new Date()} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 pb-20">{children}</main>
        <footer className="mx-auto max-w-6xl px-5 pb-8 text-xs text-muted">Research software, not investment advice. Tokenized stocks are not available to US persons.</footer>
      </body>
    </html>
  );
}
