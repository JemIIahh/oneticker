import type { Verdict as VerdictValue } from '@oneticker/core';
import { chip } from '@/lib/ui';

const STYLE: Record<VerdictValue, string> = {
  GO: 'bg-ink text-paper',
  CAUTION: 'border border-black/30 text-ink',
  BLOCK: 'bg-block text-paper',
};

export function Verdict({ value, className = '' }: { value: VerdictValue; className?: string }) {
  return <span className={`inline-block ${chip} ${STYLE[value]} ${className}`}>{value}</span>;
}
