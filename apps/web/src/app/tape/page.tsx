import { LitHours } from '@/components/LitHours';
import { card, label } from '@/lib/ui';

export default function TapePage() {
  return (
    <div className="py-14">
      <div className="grid gap-10 md:grid-cols-[1fr_auto]">
        <div className="rise max-w-xl">
          <p className={`flex items-center gap-3 ${label}`}>
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-ink" />
            Recording since 22 September
          </p>
          <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em]">The Tape</h1>
          <p className="mt-6 text-lg leading-relaxed text-graphite">
            Every five minutes, OneTicker records every price surface for five stocks across three issuers: on-chain, executable at three sizes, oracle, and reference.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-graphite">
            The question it will answer: while Wall Street is closed, does on-chain trading anticipate the Monday open, and which issuer tracks it best? The first weekend of
            data lands on Monday 28 September.
          </p>
        </div>
        <div className={`rise [animation-delay:220ms] ${card}`}>
          <p className={label}>This week</p>
          <LitHours cell={14} gap={3} at={new Date()} className="mt-4" />
        </div>
      </div>
    </div>
  );
}
