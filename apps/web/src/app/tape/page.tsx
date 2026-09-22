import { LitHours } from '@/components/LitHours';

export default function TapePage() {
  return (
    <div className="py-12">
      <div className="grid gap-10 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight">The Tape</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Every five minutes since 22 September, OneTicker records every price surface for five stocks across three issuers: on-chain, executable at three sizes, oracle,
            and reference.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            The question it will answer: while Wall Street is closed, does on-chain trading anticipate the Monday open, and which issuer tracks it best? The first weekend of
            data lands on Monday 28 September.
          </p>
        </div>
        <div className="panel px-6 py-5">
          <span className="panel-tab">Recording</span>
          <LitHours cell={14} gap={3} at={new Date()} />
        </div>
      </div>
    </div>
  );
}
