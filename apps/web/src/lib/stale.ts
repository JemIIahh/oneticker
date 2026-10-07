// When the data on screen is old, say so everywhere it appears. A live feed refreshes every minute and the Tape runs
// every five, so anything older than this means saved fixtures (or a feed that has stopped) is showing.
export const STALE_AFTER_SEC = 15 * 60;

const SAVED_AT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const isStale = (asOf: string, now: number): boolean => (now - Date.parse(asOf)) / 1000 > STALE_AFTER_SEC;
export const savedAtLabel = (asOf: string): string => `${SAVED_AT.format(new Date(asOf))} UTC`;
