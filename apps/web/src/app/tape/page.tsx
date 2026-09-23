import { WeekStrip } from '@/components/WeekStrip';

export default function TapePage() {
  return (
    <div className="pt-16 sm:pt-24">
      <p className="flex items-center gap-2.5 text-sm text-muted">
        <span className="pulse h-2 w-2 rounded-full bg-go" aria-hidden="true" />
        Recording every 5 minutes since 22 September
      </p>
      <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
        What do the tokens do while Wall Street sleeps?
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted">
        The Tape records every price for five stocks across three issuers, around the clock. The first full weekend lands Monday 28 September.
      </p>
      <WeekStrip at={new Date()} className="mt-16" />
    </div>
  );
}
