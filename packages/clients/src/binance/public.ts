// Unauthenticated Binance market data that the Web3 API does not have. Shapes from fixtures/binance/ (22 Sep 2026):
//   - bStocks collateral index: www.binance.com/bapi/margin/v1/public/margin/price-index?symbol=NVDABUSDT
//     (the web UI's endpoint; undocumented; bapi envelope {code:"000000", data:{symbol, price, timestamp}})
//   - Binance spot last price for the bStock pair: api.binance.com/api/v3/ticker/price?symbol=NVDABUSDT
//   - TradFi perpetual on the underlying (24/7): fapi.binance.com/fapi/v1/premiumIndex?symbol=NVDAUSDT
// Hosts differ by region: www.binance.com times out from the Lagos network; api/fapi refuse US IPs.
// Every call goes through onCall so the Tape records it in api_calls like the Web3 API.

import type { ApiCall } from '../web3';

export interface PublicCallOptions {
  fetch?: typeof fetch;
  onCall?: (call: ApiCall) => void;
  timeoutMs?: number;
}

/** A call as stored in raw_json: the parsed body on HTTP 200, otherwise what went wrong. */
export type PublicCaptured<T> = { at: string; ok: true; body: T } | { at: string; ok: false; httpStatus: number; error: string; body: unknown };

async function getJson<T>(url: string, opts: PublicCallOptions): Promise<PublicCaptured<T>> {
  const at = new Date().toISOString();
  const started = Date.now();
  const u = new URL(url);
  const endpoint = `${u.host}${u.pathname}`;
  const record = (httpStatus: number, errorCode: string | null, bytes: number) =>
    opts.onCall?.({ ts: at, method: 'GET', endpoint, httpStatus, latencyMs: Date.now() - started, errorCode, bytes });
  try {
    const res = await (opts.fetch ?? fetch)(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000) });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Keep the text: a WAF or geo-block page is itself evidence.
    }
    if (!res.ok) {
      const code = typeof body === 'object' && body !== null && 'code' in body ? String((body as { code: unknown }).code) : `HTTP_${res.status}`;
      record(res.status, code, text.length);
      return { at, ok: false, httpStatus: res.status, error: code, body: typeof body === 'string' ? body.slice(0, 500) : body };
    }
    record(res.status, null, text.length);
    return { at, ok: true, body: body as T };
  } catch (error) {
    const code = error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    record(0, code, 0);
    return { at, ok: false, httpStatus: 0, error: code, body: error instanceof Error ? error.message : String(error) };
  }
}

interface BapiEnvelope<T> {
  code: string;
  message: string | null;
  data: T | null;
  success: boolean;
}

export interface CollateralIndex {
  symbol: string;
  price: number;
  at: Date;
}

/** Binance's bStocks collateral index (the margin price index), e.g. symbol "NVDABUSDT". Per token, like the spot pair. */
export async function readCollateralIndex(symbol: string, opts: PublicCallOptions = {}) {
  const raw = await getJson<BapiEnvelope<{ symbol: string; price: string; timestamp: string }>>(
    `https://www.binance.com/bapi/margin/v1/public/margin/price-index?symbol=${encodeURIComponent(symbol)}`,
    opts,
  );
  const d = raw.ok && raw.body.success && raw.body.data ? raw.body.data : null;
  const value: CollateralIndex | null = d ? { symbol: d.symbol, price: Number(d.price), at: new Date(Number(d.timestamp)) } : null;
  return { value, raw };
}

/** Last trade on Binance spot for a bStock pair, e.g. "NVDABUSDT". */
export async function readSpotPrice(symbol: string, opts: PublicCallOptions = {}) {
  const raw = await getJson<{ symbol: string; price: string }>(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`, opts);
  return { value: raw.ok ? Number(raw.body.price) : null, raw };
}

export interface PerpReading {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  lastFundingRate: number;
  at: Date;
}

/** Binance TradFi perpetual on the underlying stock, e.g. "NVDAUSDT" (contractType TRADIFI_PERPETUAL). Per share. */
export async function readPerp(symbol: string, opts: PublicCallOptions = {}) {
  const raw = await getJson<{ symbol: string; markPrice: string; indexPrice: string; lastFundingRate: string; time: number }>(
    `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`,
    opts,
  );
  const value: PerpReading | null = raw.ok
    ? { symbol: raw.body.symbol, markPrice: Number(raw.body.markPrice), indexPrice: Number(raw.body.indexPrice), lastFundingRate: Number(raw.body.lastFundingRate), at: new Date(raw.body.time) }
    : null;
  return { value, raw };
}
