import { toEt } from '@oneticker/core';

/** Hours since Monday 00:00 ET, or null when no instant is given. */
export function weekHour(at?: Date): number | null {
  if (!at) return null;
  const et = toEt(at);
  const weekday = new Date(Date.UTC(et.y, et.m - 1, et.d)).getUTCDay();
  return ((weekday + 6) % 7) * 24 + et.minutes / 60;
}

const lit = (day: number, hour: number) => day < 5 && hour >= 9.5 && hour < 16;
const dim = (day: number, hour: number) => day < 5 && ((hour >= 4 && hour < 9.5) || (hour >= 16 && hour < 20));

/**
 * The week as a 7 x 24 matrix of hours with the trading hours lit. The site's signature mark: the same
 * fact as the clock ring, drawn as a grid. `cell` sets the size; `at` adds the "now" cell.
 */
export function LitHours({ cell = 6, gap = 2, at, className = '' }: { cell?: number; gap?: number; at?: Date; className?: string }) {
  const now = weekHour(at);
  const step = cell + gap;
  const w = 7 * step - gap;
  const h = 24 * step - gap;
  const cells = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const isNow = now !== null && Math.floor(now) === day * 24 + hour;
      const fill = lit(day, hour) ? 'fill-lit' : dim(day, hour) ? 'fill-lit/35' : 'fill-rule';
      cells.push(<rect key={`${day}-${hour}`} x={day * step} y={hour * step} width={cell} height={cell} className={isNow ? 'fill-ink now-pulse' : fill} rx={cell > 8 ? 1 : 0} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} role="img" aria-label="The week as a grid of hours; Wall Street trades 32.5 of 168">
      {cells}
    </svg>
  );
}

/** One row of the week, 168 cells wide, for a thin band. */
export function LitHoursBand({ at }: { at?: Date }) {
  const now = weekHour(at);
  const cells = [];
  for (let i = 0; i < 168; i++) {
    const day = Math.floor(i / 24);
    const hour = i % 24;
    const isNow = now !== null && Math.floor(now) === i;
    cells.push(
      <rect
        key={i}
        x={i * 6}
        y="0"
        width="4"
        height="4"
        className={`band-cell ${isNow ? 'fill-ink now-pulse' : lit(day, hour) ? 'fill-lit' : dim(day, hour) ? 'fill-lit/35' : 'fill-rule'}`}
        style={{ animationDelay: `${i * 6}ms` }}
      />,
    );
  }
  return (
    <svg viewBox="0 0 1006 4" preserveAspectRatio="none" className="h-1 w-full" aria-hidden="true">
      {cells}
    </svg>
  );
}
