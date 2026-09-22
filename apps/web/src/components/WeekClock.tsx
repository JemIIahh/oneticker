import { toEt, type MarketClock } from '@oneticker/core';
import { duration } from '@/lib/format';

const HOURS = 168;
const R = 54;
const C = 2 * Math.PI * R;

/** Hours since Monday 00:00 ET. */
function weekHour(at: Date): number {
  const et = toEt(at);
  const weekday = new Date(Date.UTC(et.y, et.m - 1, et.d)).getUTCDay();
  return ((weekday + 6) % 7) * 24 + et.minutes / 60;
}

function arc(fromHour: number, toHour: number, className: string, width: number, key: string) {
  const length = ((toHour - fromHour) / HOURS) * C;
  const offset = (fromHour / HOURS) * C;
  return <circle key={key} r={R} cx="0" cy="0" fill="none" strokeWidth={width} className={className} strokeDasharray={`${length} ${C - length}`} strokeDashoffset={-offset} />;
}

/** The week as a ring: 168 hours, the regular sessions lit, pre and post market dimmer, and where now sits. */
export function WeekClock({ clock, at }: { clock: MarketClock; at: Date }) {
  const now = weekHour(at);
  const angle = (now / HOURS) * 360;
  const sessions = [];
  for (let day = 0; day < 5; day++) {
    const base = day * 24;
    sessions.push(arc(base + 4, base + 9.5, 'stroke-open/30', 10, `pre${day}`));
    sessions.push(arc(base + 9.5, base + 16, 'stroke-open', 10, `reg${day}`));
    sessions.push(arc(base + 16, base + 20, 'stroke-open/30', 10, `post${day}`));
  }
  const closedFor = clock.state === 'REGULAR' ? null : duration(clock.referenceAgeSec);

  return (
    <figure className="flex items-center gap-5">
      <svg viewBox="-70 -70 140 140" width="140" height="140" role="img" aria-label={`Week clock: US market ${clock.state.toLowerCase()}`}>
        <g transform="rotate(-90)">
          <circle r={R} fill="none" strokeWidth="10" className="stroke-line" />
          {sessions}
          <g transform={`rotate(${angle})`}>
            <line x1={R - 10} x2={R + 10} y1="0" y2="0" strokeWidth="2.5" className="stroke-paper" strokeLinecap="round" />
          </g>
        </g>
        <text textAnchor="middle" y="-2" className="fill-paper text-[13px] font-semibold">
          {clock.state === 'REGULAR' ? 'Open' : 'Closed'}
        </text>
        <text textAnchor="middle" y="14" className="fill-muted text-[10px]">
          {closedFor ?? 'regular session'}
        </text>
      </svg>
      <figcaption className="text-sm text-muted">
        <span className="block text-paper">Amber marks the hours Wall Street trades, 32.5 of 168.</span>
        Tokens keep trading through the dark.
      </figcaption>
    </figure>
  );
}
