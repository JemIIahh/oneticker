import type { VenueView } from '@/lib/fixtures';
import { bps, duration, usd } from '@/lib/format';
import { Verdict } from './Verdict';

function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-t border-line px-3 py-2.5 align-top ${className}`}>{children}</td>;
}

/** The three issuers side by side. Every price is per share, so the columns compare fairly. */
export function VenueTable({ venues, referenceSep }: { venues: VenueView[]; referenceSep: number | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr>
            <th className="w-40 px-3 pb-2 text-sm font-medium text-muted">Per share</th>
            {venues.map((v) => (
              <th key={v.issuer} className="px-3 pb-2 font-medium">
                <span className="block text-muted text-sm">{v.label}</span>
                <span className="text-lg font-semibold">{v.symbol}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <Cell className="text-muted">Last on-chain price</Cell>
            {venues.map((v) => (
              <Cell key={v.issuer}>
                <span className="text-lg">{usd(v.onchainSep)}</span>
                {v.onchainAgeSec !== null && v.onchainAgeSec > 900 && <span className="ml-2 text-sm text-caution">{duration(v.onchainAgeSec)} old</span>}
              </Cell>
            ))}
          </tr>
          <tr>
            <Cell className="text-muted">You would pay, $100</Cell>
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.quote.ok ? (
                  <>
                    <span className="text-lg">{usd(v.execSep)}</span>
                    <span className="block text-sm text-muted">via {v.quote.vendor}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">{v.quote.reason}</span>
                )}
              </Cell>
            ))}
          </tr>
          <tr>
            <Cell className="text-muted">Against reference {referenceSep !== null && <span className="block">{usd(referenceSep)}</span>}</Cell>
            {venues.map((v) => (
              <Cell key={v.issuer} className={v.premiumBps !== null && v.premiumBps > 75 ? 'text-caution' : ''}>
                {bps(v.premiumBps)}
              </Cell>
            ))}
          </tr>
          <tr>
            <Cell className="text-muted">Oracle</Cell>
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.oracle ? (
                  <>
                    {usd(v.oracle.sep)}
                    <span className="block text-sm text-muted">updated {duration(v.oracle.ageSec)} ago</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">no feed</span>
                )}
              </Cell>
            ))}
          </tr>
          <tr>
            <Cell className="text-muted">Shares per token</Cell>
            {venues.map((v) => (
              <Cell key={v.issuer} className="text-sm">
                {v.shareRatio.toFixed(6)}
              </Cell>
            ))}
          </tr>
          <tr>
            <Cell className="text-muted">Verdict</Cell>
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.gate ? (
                  <>
                    <Verdict value={v.gate.verdict} />
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {v.gate.reasons.map((r) => (
                        <li key={r.code}>{r.detail}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <span className="text-sm text-muted">Excluded</span>
                )}
              </Cell>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
