import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAgenticWalletAdapter, type BawRunner } from './agentic-wallet';
import { ExecutionError } from './types';

const fixture = (name: string) => readFileSync(new URL(`../../../../fixtures/baw/${name}`, import.meta.url), 'utf8');
const NVDAB = '0x02fca66c1d1afb4e2a7884261eb00f63598a7436';
const USDT = '0x55d398326f99059fF775485246999027B3197955';

function runner(stdout: string): BawRunner & { calls: string[][] } {
  const calls: string[][] = [];
  const run = (async (args: string[]) => {
    calls.push(args);
    return stdout;
  }) as BawRunner & { calls: string[][] };
  run.calls = calls;
  return run;
}

describe('AgenticWalletAdapter', () => {
  it('quotes from the 22 Sep fixture and builds the documented command', async () => {
    const run = runner(fixture('market-order-quote-10usdt-NVDAB-20260922T103529Z.json'));
    const q = await createAgenticWalletAdapter(run).quote({ fromToken: USDT, toToken: NVDAB, fromTokenQty: '10' });
    expect(q).toMatchObject({ fromSymbol: 'USDT', fromAmount: 10, toSymbol: 'NVDAB', toAmount: 0.044067618603820916, slippage: 0.01 });
    expect(run.calls[0]).toEqual(['market-order', 'quote', '--binanceChainId', '56', '--fromTokenQty', '10', '--fromToken', USDT, '--toToken', NVDAB, '--json']);
  });

  it('raises the wallet error verbatim (fixture: NVDAx, no liquidity)', async () => {
    const run = runner(fixture('market-order-quote-10usdt-NVDAx-20260922T103529Z.json'));
    const err = await createAgenticWalletAdapter(run).quote({ fromToken: USDT, toToken: NVDAB, fromTokenQty: '10' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExecutionError);
    expect(err).toMatchObject({ code: '100', errorName: 'SERVICE_ERROR', message: 'No liquidity available, please try again later.' });
  });

  it('passes slippage only when set', async () => {
    const run = runner('{"success":true,"data":{"orderId":"1234567890"}}');
    const r = await createAgenticWalletAdapter(run).swap({ fromToken: USDT, toToken: NVDAB, fromTokenQty: '5', slippage: '1' });
    expect(r.orderId).toBe('1234567890');
    expect(run.calls[0]).toContain('--slippage');
    expect(run.calls[0]!.slice(0, 2)).toEqual(['market-order', 'swap']);
  });

  it('treats success without an orderId as a failure', async () => {
    const err = await createAgenticWalletAdapter(runner('{"success":true,"data":{}}')).swap({ fromToken: USDT, toToken: NVDAB, fromTokenQty: '5' }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'NO_ORDER_ID' });
  });

  it('reads order status by id (shape from the official skill reference)', async () => {
    const run = runner(
      '{"success":true,"data":{"total":1,"page":1,"pageSize":20,"list":[{"orderType":"market","orderId":"1234567890","chain":"56","status":"FINISHED","txHash":"0xabc"}]}}',
    );
    expect(await createAgenticWalletAdapter(run).status('1234567890')).toMatchObject({ status: 'FINISHED', txHash: '0xabc' });
    expect(run.calls[0]).toEqual(['market-order', 'list', '--orderId', '1234567890', '--json']);
  });

  it('refuses non-JSON output rather than guessing', async () => {
    const err = await createAgenticWalletAdapter(runner('Please sign in first')).quote({ fromToken: USDT, toToken: NVDAB, fromTokenQty: '1' }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'NON_JSON' });
  });
});
