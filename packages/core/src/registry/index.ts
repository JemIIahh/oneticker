import instrumentsJson from './instruments.json';
import type { Instrument } from './types';

export * from './types';

/** The hand-verified registry. Filled in by T1 from probe fixtures; capped at 5 instruments. */
export const instruments: readonly Instrument[] = instrumentsJson as Instrument[];
