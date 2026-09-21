/** A calendar date in America/New_York. */
export interface EtDate {
  y: number;
  m: number;
  d: number;
}

export const OPEN_MIN = 9 * 60 + 30;
export const CLOSE_MIN = 16 * 60;
export const EARLY_CLOSE_MIN = 13 * 60;

// NYSE 2026 calendar (and New Year 2027). No holidays fall between 21 Sep and 23 Oct 2026.
const HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25', '2027-01-01',
]);
const EARLY_CLOSES = new Set(['2026-11-27', '2026-12-24']);

const key = ({ y, m, d }: EtDate) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const isHoliday = (date: EtDate) => HOLIDAYS.has(key(date));

/** 0 = Sunday ... 6 = Saturday. */
export const weekday = ({ y, m, d }: EtDate) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

export function isTradingDay(date: EtDate): boolean {
  const w = weekday(date);
  return w !== 0 && w !== 6 && !isHoliday(date);
}

/** Minutes after midnight ET when the regular session closes on a trading day. */
export const closeMinutes = (date: EtDate) => (EARLY_CLOSES.has(key(date)) ? EARLY_CLOSE_MIN : CLOSE_MIN);

export function addDays({ y, m, d }: EtDate, days: number): EtDate {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const etFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** ET wall-clock parts of an instant. */
export function toEt(at: Date): EtDate & { minutes: number; seconds: number } {
  const p = Object.fromEntries(etFormat.formatToParts(at).map((part) => [part.type, Number(part.value)]));
  return { y: p.year!, m: p.month!, d: p.day!, minutes: p.hour! * 60 + p.minute!, seconds: p.second! };
}

/** The instant at which ET wall-clock time `date` + `minutes` occurs. */
export function fromEt(date: EtDate, minutes: number): Date {
  const wallAsUtc = Date.UTC(date.y, date.m - 1, date.d, 0, minutes);
  const offsetAt = (ms: number) => {
    const et = toEt(new Date(ms));
    return Date.UTC(et.y, et.m - 1, et.d, 0, et.minutes, et.seconds) - (ms - (ms % 1000));
  };
  let utc = wallAsUtc - offsetAt(wallAsUtc);
  const corrected = wallAsUtc - offsetAt(utc);
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}
