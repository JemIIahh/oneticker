import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ApiCall } from '../web3';
import { readCollateralIndex, readPerp, readSpotPrice } from './public';

const fixture = (name: string) => readFileSync(new URL(`../../../../fixtures/binance/${name}`, import.meta.url), 'utf8');
const respond = (status: number, body: string): typeof fetch => async () => new Response(body, { status });

describe('public Binance readers (from fixtures/binance, 22 Sep 2026)', () => {
  it('parses the bStocks collateral index and records the call', async () => {
    const calls: ApiCall[] = [];
    const { value } = await readCollateralIndex('NVDABUSDT', { fetch: respond(200, fixture('bapi-margin-price-index-NVDABUSDT-20260922T231044Z.json')), onCall: (c) => calls.push(c) });
    expect(value).toEqual({ symbol: 'NVDABUSDT', price: 228.39945125, at: new Date(1790118646000) });
    expect(calls[0]).toMatchObject({ endpoint: 'www.binance.com/bapi/margin/v1/public/margin/price-index', httpStatus: 200, errorCode: null });
  });

  it('parses the TradFi perp', async () => {
    const { value } = await readPerp('NVDAUSDT', { fetch: respond(200, fixture('fapi-premiumIndex-NVDAUSDT-20260922T230858Z.json')) });
    expect(value).toMatchObject({ symbol: 'NVDAUSDT', markPrice: 228.5, indexPrice: 228.41077025, lastFundingRate: 0.00020304 });
  });

  it('parses the spot ticker', async () => {
    const { value } = await readSpotPrice('NVDABUSDT', { fetch: respond(200, '{"symbol":"NVDABUSDT","price":"228.35000000"}') });
    expect(value).toBe(228.35);
  });

  it('keeps a geo-block as data, with its code', async () => {
    const calls: ApiCall[] = [];
    const { value, raw } = await readPerp('NVDAUSDT', {
      fetch: respond(451, '{"code":0,"msg":"Service unavailable from a restricted location"}'),
      onCall: (c) => calls.push(c),
    });
    expect(value).toBeNull();
    expect(raw).toMatchObject({ ok: false, httpStatus: 451 });
    expect(calls[0]).toMatchObject({ httpStatus: 451, errorCode: '0' });
  });

  it('records timeouts and network failures without throwing', async () => {
    const calls: ApiCall[] = [];
    const failing: typeof fetch = async () => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    };
    const { value, raw } = await readSpotPrice('NVDABUSDT', { fetch: failing, onCall: (c) => calls.push(c) });
    expect(value).toBeNull();
    expect(raw).toMatchObject({ ok: false, error: 'TIMEOUT' });
    expect(calls[0]).toMatchObject({ httpStatus: 0, errorCode: 'TIMEOUT' });
  });

  it('treats a bapi failure envelope as no value', async () => {
    const { value } = await readCollateralIndex('NOPEUSDT', { fetch: respond(200, '{"code":"100001","message":"bad symbol","data":null,"success":false}') });
    expect(value).toBeNull();
  });
});
