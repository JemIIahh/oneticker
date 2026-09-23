'use client';

import { marketClock } from '@oneticker/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { History, HistoryPoint } from '@/lib/history';
import { bps, usd } from '@/lib/format';

/**
 * 72 hours of one stock, per share, with the hours Wall Street was closed shaded. Three series (the validated
 * all-pairs cap), one axis, direct labels at the line ends, a crosshair tooltip, and a table view.
 */
const SERIES = [
  { key: 'perp', label: '24/7 perp', hint: 'Binance perpetual on the stock', color: 'var(--series-1)' },
  { key: 'pool', label: 'On-chain pool', hint: 'PancakeSwap, bStocks token', color: 'var(--series-2)' },
  { key: 'quote', label: 'Best $100 quote', hint: 'Cheapest of the three issuers', color: 'var(--series-3)' },
] as const;
type Key = (typeof SERIES)[number]['key'];

const HEIGHT = 300;
const M = { top: 12, right: 104, bottom: 28, left: 64 };
/** A gap longer than this between Tape runs breaks the line instead of bridging it. */
const MAX_GAP_MS = 15 * 60_000;

const ET_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
const ET_FULL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });

function niceTicks(min: number, max: number, count = 4): number[] {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Midnight ET of each day in the window, for the x-axis. */
function dayTicks(from: number, to: number): { t: number; label: string }[] {
  const out: { t: number; label: string }[] = [];
  for (let t = Math.ceil(from / 3_600_000) * 3_600_000; t <= to; t += 3_600_000) {
    const parts = ET_DAY.formatToParts(new Date(t));
    if (Number(parts.find((p) => p.type === 'hour')?.value) === 0) out.push({ t, label: parts.find((p) => p.type === 'weekday')!.value });
  }
  return out;
}

const ET_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric' });

/** Whole hours across a short window, about `count` of them. */
function hourTicks(from: number, to: number, count: number): { t: number; label: string }[] {
  const stepH = Math.max(1, Math.ceil((to - from) / 3_600_000 / count));
  const out: { t: number; label: string }[] = [];
  for (let t = Math.ceil(from / 3_600_000) * 3_600_000; t <= to; t += stepH * 3_600_000) out.push({ t, label: ET_HOUR.format(new Date(t)) });
  return out;
}

/** Readings with no neighbour close enough to draw a line to; drawn as dots so they are not lost. */
function isolated(points: HistoryPoint[], key: Key): HistoryPoint[] {
  const withValue = points.filter((p) => p[key] !== null);
  return withValue.filter((p, i) => {
    const prev = withValue[i - 1];
    const next = withValue[i + 1];
    return (!prev || p.t - prev.t > MAX_GAP_MS) && (!next || next.t - p.t > MAX_GAP_MS);
  });
}

function linePath(points: HistoryPoint[], key: Key, x: (t: number) => number, y: (v: number) => number): string {
  let d = '';
  let prev: number | null = null;
  for (const p of points) {
    const v = p[key];
    if (v === null) {
      prev = null;
      continue;
    }
    d += `${prev === null || p.t - prev > MAX_GAP_MS ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(v).toFixed(1)}`;
    prev = p.t;
  }
  return d;
}

export function PriceHistory({ history }: { history: History }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<HistoryPoint | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, to } = history;
  // Until the Tape has a full window, zoom to what it has recorded rather than squeezing it against the right edge.
  const first = points[0]?.t ?? history.from;
  const from = Math.max(history.from, first - 30 * 60_000);
  const closed = history.closed.filter(([, b]) => b > from).map(([a, b]): [number, number] => [Math.max(a, from), b]);
  const partial = from > history.from;
  const narrow = width < 520;
  const m = { ...M, right: narrow ? 12 : M.right, left: narrow ? 52 : M.left };
  const plotW = width - m.left - m.right;
  const plotH = HEIGHT - m.top - m.bottom;

  const values = points.flatMap((p) => SERIES.map((s) => p[s.key]).filter((v): v is number => v !== null));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, ((hi + lo) / 2) * 0.0008);
  const yMin = lo - pad;
  const yMax = hi + pad;

  const x = (t: number) => m.left + ((t - from) / (to - from)) * plotW;
  const y = (v: number) => m.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const yTicks = niceTicks(yMin, yMax);
  // Day labels for a multi-day window; hours when zoomed into less than a day.
  const xTicks = to - from > 36 * 3_600_000 ? dayTicks(from, to) : hourTicks(from, to, width < 520 ? 4 : 6);

  // Direct labels at each line's last reading, nudged apart so they never overlap.
  const ends = useMemo(() => {
    const e = SERIES.flatMap((s) => {
      const last = [...points].reverse().find((p) => p[s.key] !== null);
      return last ? [{ ...s, v: last[s.key]!, t: last.t, ly: 0 }] : [];
    }).sort((a, b) => b.v - a.v);
    for (const item of e) item.ly = m.top + (1 - (item.v - yMin) / (yMax - yMin)) * plotH;
    for (let i = 1; i < e.length; i++) if (e[i]!.ly - e[i - 1]!.ly < 16) e[i]!.ly = e[i - 1]!.ly + 16;
    return e;
  }, [points, yMin, yMax, plotH, m.top]);

  function onMove(ev: React.PointerEvent<SVGRectElement>) {
    const rect = ev.currentTarget.getBoundingClientRect();
    const t = from + ((ev.clientX - rect.left) / rect.width) * (to - from);
    let best: HistoryPoint | null = null;
    for (const p of points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    setHover(best && Math.abs(best.t - t) < MAX_GAP_MS * 2 ? best : null);
  }

  const hourly = useMemo(() => {
    const byHour = new Map<number, HistoryPoint>();
    for (const p of points) byHour.set(Math.floor(p.t / 3_600_000), p);
    return [...byHour.values()].reverse();
  }, [points]);

  return (
    <figure className="m-0">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2" title={s.hint}>
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-ink/[0.07]" aria-hidden="true" />
          Wall Street closed
        </li>
      </ul>

      {partial && (
        <p className="mt-3 text-xs text-muted">
          Showing what the Tape has recorded so far, since {ET_FULL.format(new Date(first))} ET. Times are New York time.
        </p>
      )}

      <div ref={box} className="relative mt-4">
        <svg width={width} height={HEIGHT} role="img" aria-label="Price per share over the last 72 hours" className="block overflow-visible">
          {closed.map(([a, b]) => (
            <rect key={a} x={x(a)} y={m.top} width={Math.max(0, x(b) - x(a))} height={plotH} className="fill-ink/[0.05]" />
          ))}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} className="stroke-line" />
              <text x={m.left - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                ${usd(v)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={tick.t} x={x(tick.t)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[11px]">
              {tick.label}
            </text>
          ))}
          {SERIES.map((s) => (
            <g key={s.key}>
              <path d={linePath(points, s.key, x, y)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {isolated(points, s.key).map((p) => (
                <circle key={p.t} cx={x(p.t)} cy={y(p[s.key]!)} r={2.5} fill={s.color} />
              ))}
            </g>
          ))}
          {!narrow &&
            ends.map((e) => (
              <g key={e.key}>
                <circle cx={x(e.t)} cy={y(e.v)} r={4} fill={e.color} className="stroke-surface" strokeWidth={2} />
                <text x={width - m.right + 12} y={e.ly} dy="0.32em" className="fill-ink text-[12px]">
                  {e.label}
                </text>
              </g>
            ))}
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover.t)} x2={x(hover.t)} y1={m.top} y2={m.top + plotH} className="stroke-muted" strokeDasharray="3 3" />
              {SERIES.map((s) =>
                hover[s.key] === null ? null : <circle key={s.key} cx={x(hover.t)} cy={y(hover[s.key]!)} r={4.5} fill={s.color} className="stroke-surface" strokeWidth={2} />,
              )}
            </g>
          )}
          <rect x={m.left} y={m.top} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-line bg-raised p-3 text-sm shadow-lg"
            style={{ left: Math.min(Math.max(x(hover.t) - 112, 0), width - 224) }}
          >
            <p className="font-medium">{ET_FULL.format(new Date(hover.t))} ET</p>
            <p className="text-xs text-muted">{marketClock(new Date(hover.t)).state === 'REGULAR' ? 'Wall Street open' : 'Wall Street closed'}</p>
            <dl className="mt-2 space-y-1">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <dt className="flex-1 text-muted">{s.label}</dt>
                  <dd>{hover[s.key] === null ? '—' : `$${usd(hover[s.key])}`}</dd>
                </div>
              ))}
            </dl>
            {hover.pool !== null && hover.perp !== null && (
              <p className="mt-2 border-t border-line pt-2 text-xs text-muted">Pool vs perp: {bps((hover.pool / hover.perp - 1) * 10_000)}</p>
            )}
          </div>
        )}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as a table (one row per hour)</summary>
        <div className="mt-3 max-h-80 overflow-auto rounded-2xl border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Time (ET)</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-4 py-2 font-normal">
                    {s.label}
                  </th>
                ))}
                <th className="px-4 py-2 font-normal">Pool vs perp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {hourly.map((p) => (
                <tr key={p.t}>
                  <td className="px-4 py-2 whitespace-nowrap">{ET_FULL.format(new Date(p.t))}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-4 py-2">
                      {p[s.key] === null ? '—' : `$${usd(p[s.key])}`}
                    </td>
                  ))}
                  <td className="px-4 py-2">{p.pool !== null && p.perp !== null ? bps((p.pool / p.perp - 1) * 10_000) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
