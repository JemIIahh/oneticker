/** Milliseconds until the next wall-clock slot (e.g. :00, :05, :10 for 300 s). Always > 0. */
export function msUntilNextSlot(nowMs: number, intervalSec: number): number {
  const intervalMs = intervalSec * 1000;
  return intervalMs - (nowMs % intervalMs);
}

/** YYYY-MM-DD of the UTC day before `date`. */
export function previousUtcDay(date: Date): string {
  return new Date(date.getTime() - 86_400_000).toISOString().slice(0, 10);
}
