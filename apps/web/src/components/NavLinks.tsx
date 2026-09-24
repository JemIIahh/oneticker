'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Route', match: (p: string) => p === '/' },
  { href: '/s/NVDA', label: 'Stocks', match: (p: string) => p.startsWith('/s/') },
  { href: '/tape', label: 'Tape', match: (p: string) => p.startsWith('/tape') },
];

/** The pages as a segmented control; the current one is raised. */
export function NavLinks({ className = '' }: { className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Pages" className={`flex h-9 items-center rounded-full border border-line bg-surface/60 p-1 backdrop-blur ${className}`}>
      {LINKS.map((l) => {
        const active = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-full items-center rounded-full px-3.5 text-sm font-medium transition ${active ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-muted hover:text-ink'}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
