import { toEt, type MarketClock } from '@oneticker/core';
import { duration } from '@/lib/format';
import { card, label } from '@/lib/ui';

const HOURS = 168;
const R = 60;
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

/** The week as a ring: 168 hours, the regular sessions in ink, pre and post market lighter, and where now sits. */
export function WeekClock({ clock, at }: { clock: MarketClock; at: Date }) {
  const angle = (weekHour(at) / HOURS) * 360;
  const sessions = [];
  for (let day = 0; day < 5; day++) {
    const base = day * 24;
    sessions.push(arc(base + 4, base + 9.5, 'stroke-ink/35', 12, `pre${day}`));
    sessions.push(arc(base + 9.5, base + 16, 'stroke-ink', 12, `reg${day}`));
    sessions.push(arc(base + 16, base + 20, 'stroke-ink/35', 12, `post${day}`));
  }
  const open = clock.state === 'REGULAR';

  return (
    <div className={`rise [animation-delay:220ms] ${card} flex items-center gap-6`}>
      <svg viewBox="-78 -78 156 156" width="156" height="156" role="img" aria-label={`Week clock: US market ${clock.state.toLowerCase()}`}>
        <g transform="rotate(-90)">
          <circle r={R} fill="none" strokeWidth="12" className="stroke-ink/10" />
          {sessions}
          <g transform={`rotate(${angle})`}>
            <line x1={R - 13} x2={R + 13} y1="0" y2="0" strokeWidth="3" className="stroke-block" strokeLinecap="round" />
          </g>
        </g>
        <text textAnchor="middle" y="-2" className="fill-ink text-[15px] font-semibold">
          {open ? 'Open' : 'Closed'}
        </text>
        <text textAnchor="middle" y="15" className="fill-graphite font-mono text-[10px]">
          {open ? 'regular session' : duration(clock.referenceAgeSec)}
        </text>
      </svg>
      <div className="max-w-[12rem]">
        <p className={label}>Week clock</p>
        <p className="mt-2 text-sm text-ink">Ink is when Wall Street trades: 32.5 of 168 hours.</p>
        <p className="mt-1 text-sm text-graphite">The red tick is now. Tokens keep trading through the dark.</p>
      </div>
    </div>
  );
}
