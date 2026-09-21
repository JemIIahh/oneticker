import { addDays, closeMinutes, fromEt, isHoliday, isTradingDay, OPEN_MIN, toEt, weekday, type EtDate } from './calendar';

/** HALTED is never produced by the calendar; it comes from corporate-action or issuer-pause signals. */
export type MarketState = 'REGULAR' | 'PRE' | 'POST' | 'OVERNIGHT' | 'WEEKEND' | 'HOLIDAY' | 'HALTED';

export interface MarketClock {
  state: Exclude<MarketState, 'HALTED'>;
  /** Seconds since the last regular-session close; 0 during REGULAR. Drives the gate, not the label. */
  referenceAgeSec: number;
  lastClose: Date;
  nextOpen: Date;
  nextClose: Date;
}

const PRE_MIN = 4 * 60;
const EVENING_MIN = 20 * 60;

function stateAt(date: EtDate, minutes: number): MarketClock['state'] {
  const w = weekday(date);
  if (w === 6 || (w === 5 && minutes >= EVENING_MIN) || (w === 0 && minutes < EVENING_MIN)) return 'WEEKEND';
  if (w === 0) return 'OVERNIGHT';
  if (isHoliday(date)) return 'HOLIDAY';
  if (minutes < PRE_MIN) return 'OVERNIGHT';
  if (minutes < OPEN_MIN) return 'PRE';
  if (minutes < closeMinutes(date)) return 'REGULAR';
  if (minutes < EVENING_MIN) return 'POST';
  return 'OVERNIGHT';
}

function nextTradingDay(from: EtDate): EtDate {
  let date = from;
  while (!isTradingDay(date)) date = addDays(date, 1);
  return date;
}

function previousTradingDay(from: EtDate): EtDate {
  let date = from;
  while (!isTradingDay(date)) date = addDays(date, -1);
  return date;
}

/** US equity market clock (NYSE calendar, America/New_York). */
export function marketClock(now: Date): MarketClock {
  const et = toEt(now);
  const today: EtDate = { y: et.y, m: et.m, d: et.d };
  const minutes = et.minutes + et.seconds / 60;
  const tradingToday = isTradingDay(today);

  const openDay = tradingToday && minutes < OPEN_MIN ? today : nextTradingDay(addDays(today, 1));
  const closeDay = tradingToday && minutes < closeMinutes(today) ? today : nextTradingDay(addDays(today, 1));
  const lastCloseDay = tradingToday && minutes >= closeMinutes(today) ? today : previousTradingDay(addDays(today, -1));

  const state = stateAt(today, minutes);
  const lastClose = fromEt(lastCloseDay, closeMinutes(lastCloseDay));
  return {
    state,
    referenceAgeSec: state === 'REGULAR' ? 0 : Math.floor((now.getTime() - lastClose.getTime()) / 1000),
    lastClose,
    nextOpen: fromEt(openDay, OPEN_MIN),
    nextClose: fromEt(closeDay, closeMinutes(closeDay)),
  };
}
