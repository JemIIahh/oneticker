import { toEt } from '@oneticker/core';

/** Hours since Monday 00:00 ET. */
export function weekHour(at: Date): number {
  const et = toEt(at);
  const weekday = new Date(Date.UTC(et.y, et.m - 1, et.d)).getUTCDay();
  return ((weekday + 6) % 7) * 24 + et.minutes / 60;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TICKS = [0, 6, 12, 18];
const TICK_LABEL = ['12am', '6am', '12pm', '6pm'];
const pct = (hour: number) => `${(hour / 24) * 100}%`;
const NOW_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

/**
 * The week as a calendar: one row per day, midnight to midnight New York time. The solid block is Wall Street's
 * regular session; the rest of every row, and all of Saturday and Sunday, is when only the tokens trade.
 */
export function WeekStrip({ at, className = '' }: { at: Date; className?: string }) {
  const now = weekHour(at);
  const today = Math.floor(now / 24);
  const nowHour = now % 24;

  return (
    <figure className={className} aria-label="Wall Street is open 9:30am to 4pm New York time, Monday to Friday: 32.5 of 168 hours">
      <div className="grid grid-cols-[2.75rem_1fr_3rem] items-end gap-x-3 pb-2 text-xs text-muted sm:grid-cols-[3.5rem_1fr_4rem]">
        <span />
        <span className="relative h-4">
          {TICKS.map((h, i) => (
            <span key={h} className="absolute" style={{ left: pct(h) }}>
              {TICK_LABEL[i]}
            </span>
          ))}
        </span>
        <span className="text-right">Open</span>
      </div>

      <ol className="space-y-1.5">
        {DAYS.map((d, i) => {
          const weekday = i < 5;
          const isToday = i === today;
          return (
            <li key={d} className="grid grid-cols-[2.75rem_1fr_3rem] items-center gap-x-3 sm:grid-cols-[3.5rem_1fr_4rem]">
              <span className={`text-sm ${isToday ? 'font-semibold text-ink' : 'text-muted'}`}>{d}</span>
              <span className={`relative h-7 overflow-hidden rounded-lg bg-raised ${isToday ? 'ring-1 ring-muted/50' : ''}`}>
                {TICKS.slice(1).map((h) => (
                  <span key={h} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(h) }} />
                ))}
                {weekday && <span className="absolute inset-y-1 rounded-md bg-session" style={{ left: pct(9.5), width: pct(6.5) }} />}
                {isToday && <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-ink shadow-[0_0_0_2px_var(--bg)]" style={{ left: pct(nowHour) }} />}
              </span>
              <span className={`text-right text-sm ${weekday ? 'text-ink' : 'text-faint'}`}>{weekday ? '6½h' : '0h'}</span>
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[4px] bg-session" aria-hidden="true" />
          Wall Street open
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[4px] bg-raised ring-1 ring-line" aria-hidden="true" />
          Only the tokens trade
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-[3px] rounded-full bg-ink" aria-hidden="true" />
          Now, {NOW_FMT.format(at)} ET
        </span>
      </figcaption>
    </figure>
  );
}
