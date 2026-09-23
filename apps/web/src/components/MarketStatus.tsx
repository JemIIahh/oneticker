import type { MarketClock } from '@oneticker/core';
import { duration } from '@/lib/format';

/** Whether Wall Street is trading, in one line: a lit dot when open, a dim one and the wait when closed. */
export function MarketStatus({ clock, at = new Date(), className = '' }: { clock: MarketClock; at?: Date; className?: string }) {
  const open = clock.state === 'REGULAR';
  const wait = Math.max(0, Math.floor((new Date(clock.nextOpen).getTime() - at.getTime()) / 1000));
  return (
    <p className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-sm backdrop-blur ${className}`}>
      <span className={`h-2 w-2 rounded-full ${open ? 'pulse bg-go' : 'bg-faint'}`} aria-hidden="true" />
      <span className="font-medium">
        <span className="sm:hidden">Market </span>
        <span className="hidden sm:inline">Wall Street </span>
        {open ? 'open' : 'closed'}
      </span>
      <span className="hidden text-muted sm:inline">{open ? `until ${new Date(clock.nextClose).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET` : `opens in ${duration(wait)}`}</span>
    </p>
  );
}
