import type { Verdict as VerdictValue } from '@oneticker/core';

const STYLE: Record<VerdictValue, string> = {
  GO: 'text-go border-go/50',
  CAUTION: 'text-caution border-caution/50',
  BLOCK: 'text-block border-block/50',
};

export function Verdict({ value, className = '' }: { value: VerdictValue; className?: string }) {
  return <span className={`inline-block rounded-sm border px-2 py-0.5 text-sm font-semibold ${STYLE[value]} ${className}`}>{value}</span>;
}
