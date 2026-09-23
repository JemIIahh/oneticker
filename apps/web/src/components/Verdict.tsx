import type { Verdict as VerdictValue } from '@oneticker/core';

export const VERDICT_TEXT: Record<VerdictValue, { word: string; meaning: string; color: string }> = {
  GO: { word: 'Go', meaning: 'Safe to buy now', color: 'text-go' },
  CAUTION: { word: 'Caution', meaning: 'Buy with care', color: 'text-caution' },
  BLOCK: { word: 'Block', meaning: 'Don’t buy now', color: 'text-block' },
};

/** Check, exclamation, cross: the verdict still reads without colour. */
export function VerdictIcon({ value, className = '' }: { value: VerdictValue; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`fill-none stroke-current ${className}`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {value === 'GO' && <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />}
      {value === 'CAUTION' && (
        <>
          <path d="M8 3.5v5.5" />
          <path d="M8 12.4v.1" />
        </>
      )}
      {value === 'BLOCK' && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />}
    </svg>
  );
}

/** The gate's verdict as a quiet pill: neutral text, the colour only in the icon disc. */
export function Verdict({ value, className = '' }: { value: VerdictValue; className?: string }) {
  const v = VERDICT_TEXT[value];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-line bg-raised py-1 pr-3 pl-1 text-sm font-medium text-ink ${className}`}>
      <VerdictDisc value={value} className="h-5 w-5" />
      {v.word}
    </span>
  );
}

/** A solid disc in the verdict's colour with the icon cut out of it. */
export function VerdictDisc({ value, className = '' }: { value: VerdictValue; className?: string }) {
  const bg = { GO: 'bg-go', CAUTION: 'bg-caution', BLOCK: 'bg-block' }[value];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full text-bg ${bg} ${className}`}>
      <VerdictIcon value={value} className="h-[62%] w-[62%]" />
    </span>
  );
}
