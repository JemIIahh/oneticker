// What the pages call. Live from the Tape when TAPE_API_URL is set and answering; otherwise the saved fixtures.
import { instruments, type Instrument } from '@oneticker/core';
import { fixtureView } from './fixtures';
import { fetchLatest, liveViews } from './live';
import type { InstrumentView } from './view';

export function listInstruments(): Instrument[] {
  return [...instruments];
}

/** Every instrument's view. `at` overrides "now" so closed-market states can be previewed. */
export async function getAllInstruments(at?: Date): Promise<InstrumentView[]> {
  const now = at ?? new Date();
  const payload = await fetchLatest();
  if (payload) {
    const views = liveViews(payload, now);
    // A live feed with no Binance prices at all (e.g. the 40304 compliance block) is worse than the fixtures.
    if (views.some((v) => v.venues.some((venue) => venue.execSep !== null || venue.onchainSep !== null))) return views;
  }
  return instruments.map((i) => fixtureView(i.ticker, at)!);
}

export async function getInstrument(ticker: string, at?: Date): Promise<InstrumentView | null> {
  const all = await getAllInstruments(at);
  return all.find((v) => v.ticker === ticker.toUpperCase()) ?? null;
}
