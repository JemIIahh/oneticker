import type { Verdict as VerdictValue } from '@oneticker/core';

const STYLE: Record<VerdictValue, string> = {
  GO: 'text-go bg-go/10 border-go/40',
  CAUTION: 'text-caution bg-caution/10 border-caution/40',
  BLOCK: 'text-block bg-block/10 border-block/40',
};

export function Verdict({ value, className = '' }: { value: VerdictValue; className?: string }) {
  return <span className={`inline-block rounded-sm border px-2 py-0.5 text-sm font-semibold ${STYLE[value]} ${className}`}>{value}</span>;
}
