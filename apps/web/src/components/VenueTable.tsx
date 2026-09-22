import type { VenueView } from '@/lib/view';
import { bps, duration, usd } from '@/lib/format';
import { card, label } from '@/lib/ui';
import { Verdict } from './Verdict';

function Row({ name, children }: { name: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr className="border-t border-black/10">
      <th scope="row" className={`w-44 py-4 pr-4 text-left align-top font-normal ${label}`}>
        {name}
      </th>
      {children}
    </tr>
  );
}

const Cell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <td className={`py-4 pr-4 align-top ${className}`}>{children}</td>;

/** The three issuers side by side. Every price is per share, so the columns compare fairly. */
export function VenueTable({ venues, referenceSep }: { venues: VenueView[]; referenceSep: number | null }) {
  return (
    <section className={`rise [animation-delay:320ms] ${card} overflow-x-auto`}>
      <p className={label}>Three tokens, one share</p>
      <table className="mt-5 w-full min-w-[600px]">
        <thead>
          <tr>
            <th className={`pb-3 pr-4 text-left font-normal ${label}`}>Per share</th>
            {venues.map((v) => (
              <th key={v.issuer} className="pb-3 pr-4 text-left">
                <span className={`block ${label}`}>{v.label}</span>
                <span className="font-mono text-xl font-medium">{v.symbol}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row name="Last on-chain">
            {venues.map((v) => (
              <Cell key={v.issuer}>
                <span className="font-mono text-xl">{usd(v.onchainSep)}</span>
                {v.onchainAgeSec !== null && v.onchainAgeSec > 900 && <span className="ml-2 font-mono text-[11px] text-graphite">{duration(v.onchainAgeSec)} old</span>}
              </Cell>
            ))}
          </Row>
          <Row name="You would pay, $100">
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.quote.ok ? (
                  <>
                    <span className="font-mono text-xl">{usd(v.execSep)}</span>
                    <span className="block font-mono text-[11px] text-graphite">via {v.quote.vendor}</span>
                  </>
                ) : (
                  <span className="text-sm text-graphite">{v.quote.reason}</span>
                )}
              </Cell>
            ))}
          </Row>
          <Row
            name={
              <>
                Vs reference
                {referenceSep !== null && <span className="mt-1 block font-mono text-sm normal-case tracking-normal text-ink">{usd(referenceSep)}</span>}
              </>
            }
          >
            {venues.map((v) => (
              <Cell key={v.issuer} className={`font-mono ${v.premiumBps !== null && v.premiumBps > 75 ? 'text-block' : ''}`}>
                {bps(v.premiumBps)}
              </Cell>
            ))}
          </Row>
          <Row name="Oracle">
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.oracle ? (
                  <>
                    <span className="font-mono">{usd(v.oracle.sep)}</span>
                    <span className="block font-mono text-[11px] text-graphite">updated {duration(v.oracle.ageSec)} ago</span>
                  </>
                ) : (
                  <span className="text-sm text-graphite">no feed</span>
                )}
              </Cell>
            ))}
          </Row>
          <Row name="Shares per token">
            {venues.map((v) => (
              <Cell key={v.issuer} className="font-mono text-sm">
                {v.shareRatio.toFixed(6)}
              </Cell>
            ))}
          </Row>
          <Row name="Verdict">
            {venues.map((v) => (
              <Cell key={v.issuer}>
                {v.gate ? (
                  <>
                    <Verdict value={v.gate.verdict} />
                    <ul className="mt-3 space-y-1 text-sm text-graphite">
                      {v.gate.reasons.map((r) => (
                        <li key={r.code}>{r.detail}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <span className="text-sm text-graphite">Excluded</span>
                )}
              </Cell>
            ))}
          </Row>
        </tbody>
      </table>
    </section>
  );
}
