'use client';

import dynamic from 'next/dynamic';
import { LitHours } from './LitHours';

const WeekRing3D = dynamic(() => import('./WeekRing3D').then((m) => m.WeekRing3D), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center">
      <LitHours cell={12} gap={3} />
    </div>
  ),
});

/** Client wrapper so the WebGL scene only loads in the browser; the server renders the flat grid meanwhile. */
export function WeekRingPanel({ nowHour }: { nowHour: number }) {
  return <WeekRing3D nowHour={nowHour} />;
}
