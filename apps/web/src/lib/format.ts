export const usd = (n: number | null, digits = 2): string => (n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

export function bps(n: number | null): string {
  if (n === null) return '—';
  const r = Math.round(n);
  return `${r > 0 ? '+' : ''}${r} bps`;
}

export function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${m}m`;
}

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', hour: 'numeric', minute: '2-digit' });
export const etTime = (d: Date | string) => ET.format(new Date(d)).replace(',', '');
