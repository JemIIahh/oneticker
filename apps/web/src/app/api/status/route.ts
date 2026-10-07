// Where the numbers on the site come from, and whether the live read is working. No secrets: only counts and error codes.
import { directEnabled, directViews } from '@/lib/direct';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const enabled = directEnabled();
  const views = enabled ? await directViews(new Date()) : null;
  const exclusions: Record<string, number> = {};
  for (const v of views ?? []) for (const venue of v.venues) if (!venue.quote.ok) exclusions[venue.quote.code] = (exclusions[venue.quote.code] ?? 0) + 1;
  const quoted = (views ?? []).reduce((n, v) => n + v.venues.filter((venue) => venue.quote.ok).length, 0);
  return Response.json({
    directRead: enabled,
    region: process.env.VERCEL_REGION ?? null,
    live: quoted > 0,
    asOf: views?.[0]?.asOf ?? null,
    venuesQuoted: quoted,
    exclusions,
  });
}
