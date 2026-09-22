import type { Metadata } from 'next';
import { JetBrains_Mono, Schibsted_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { LitHoursBand } from '@/components/LitHours';
import './globals.css';

const grotesk = Schibsted_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-grotesk' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'OneTicker',
  description: 'One ticker in. The safest fill out, even when Wall Street is closed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${jetbrains.variable}`}>
      <body>
        <div className="atmosphere" aria-hidden="true" />
        <header className="mx-auto max-w-6xl px-6 pt-6">
          <nav className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]">
              <span className="inline-block h-6 w-6 rounded-[7px] bg-ink" aria-hidden="true" />
              OneTicker
            </Link>
            <Link href="/tape" className="font-mono text-[11px] uppercase tracking-[0.22em] text-graphite transition hover:text-ink">
              The Tape
            </Link>
            <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.22em] text-graphite sm:inline">Tokenized US stocks on BNB Chain</span>
          </nav>
          <div className="mt-5">
            <LitHoursBand at={new Date()} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-24">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-10 font-mono text-[11px] text-graphite">Research software, not investment advice. Tokenized stocks are not available to US persons.</footer>
      </body>
    </html>
  );
}
