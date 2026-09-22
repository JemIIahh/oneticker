import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import Link from 'next/link';
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
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-6xl items-baseline gap-6 px-4 py-3">
            <Link href="/" className="text-base font-semibold">
              OneTicker
            </Link>
            <Link href="/tape" className="text-sm text-muted hover:text-paper">
              The Tape
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
