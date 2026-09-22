import type { VenueView } from '@/lib/fixtures';
import { bps, duration, usd } from '@/lib/format';
import { Verdict } from './Verdict';

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr className="border-t border-rule">
      <th scope="row" className="w-44 px-6 py-3.5 text-left align-top text-sm font-normal text-muted">
        {label}
      </th>
      {children}
    </tr>
  );
}

const Cell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <td className={`num px-4 py-3.5 align-top ${className}`}>{children}</td>;

/** The three issuers side by side. Every price is per share, so the columns compare fairly. */
export function VenueTable({ venues, referenceSep }: { venues: VenueView[]; referenceSep: number | null }) {
  return (
    <div className="panel overflow-x-auto">
      <span className="panel-tab">Three tokens, one share</span>
      <table className="w-full min-w-[600px]">
        <thead>
          <tr>
            <th className="px-6 pb-3 pt-6 text-left text-sm font-normal text-muted">Per share</th>
            {venues.map((v) => (
              <th key={v.issuer} className="px-4 pb-3 pt-6 text-left">
                <span className="block text-sm font-normal text-muted">{v.label}</span>
                <span className="text-xl font-semibold">{v.symbol}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Last on-chain price">
            {venues.map((v) => (
              <Cell key={v.issuer}>
                <span className="text-xl">{usd(v.onchainSep)}</span>
                {v.onchainAgeSec !== null && v.onchainAgeSec > 900 && <span className="ml-2 text-sm text-caution">{duration(v.onchainAgeSec)} old</span>}
              </Cell>
            ))}
          </Row>
          <Row label="You would pay, $100">
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.quote.ok ? (
                  <>
                    <span className="text-xl">{usd(v.execSep)}</span>
                    <span className="block text-sm text-muted">via {v.quote.vendor}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">{v.quote.reason}</span>
                )}
              </Cell>
            ))}
          </Row>
          <Row
            label={
              <>
                Against reference
                {referenceSep !== null && <span className="num block text-ivory">{usd(referenceSep)}</span>}
              </>
            }
          >
            {venues.map((v) => (
              <Cell key={v.issuer} className={v.premiumBps !== null && v.premiumBps > 75 ? 'text-caution' : ''}>
                {bps(v.premiumBps)}
              </Cell>
            ))}
          </Row>
          <Row label="Oracle">
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
          </Row>
          <Row label="Shares per token">
            {venues.map((v) => (
              <Cell key={v.issuer} className="text-sm">
                {v.shareRatio.toFixed(6)}
              </Cell>
            ))}
          </Row>
          <Row label="Verdict">
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
          </Row>
        </tbody>
      </table>
    </div>
  );
}
