// AgenticWalletAdapter: drives the `baw` CLI (@binance/agentic-wallet). Shapes from fixtures/baw/ and the official
// skill's references/market-order.md. `baw` wraps every result as {success, data} or {success:false, error:{code,
// name, message}}, and its exit code is not reliable (an expired QR once exited 0), so the envelope decides.

import { execFile } from 'node:child_process';
import { ExecutionError, type AdapterQuote, type ExecutionAdapter, type OrderState, type OrderStatus, type SwapRequest } from './types';

const BSC = '56';

/** Runs `baw <args>` and returns stdout. Injected in tests. No shell: arguments are passed as an array. */
export type BawRunner = (args: string[]) => Promise<string>;

export const runBaw: BawRunner = (args) =>
  new Promise((resolve, reject) => {
    execFile('baw', args, { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      // A non-zero exit with a JSON envelope on stdout is still an answer; only fail when there is nothing to parse.
      if (error && !stdout) reject(error);
      else resolve(stdout);
    });
  });

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: number | string; name: string; message: string } };

async function call<T>(run: BawRunner, args: string[]): Promise<T> {
  const command = `baw ${args.slice(0, 2).join(' ')}`;
  const stdout = await run([...args, '--json']);
  let envelope: Envelope<T>;
  try {
    envelope = JSON.parse(stdout) as Envelope<T>;
  } catch {
    throw new ExecutionError(command, 'NON_JSON', 'NON_JSON', `baw printed something that is not JSON: ${stdout.slice(0, 200)}`, stdout);
  }
  if (!envelope.success) throw new ExecutionError(command, String(envelope.error.code), envelope.error.name, envelope.error.message, envelope);
  return envelope.data;
}

const swapArgs = (req: SwapRequest) => [
  '--binanceChainId',
  BSC,
  '--fromTokenQty',
  req.fromTokenQty,
  '--fromToken',
  req.fromToken,
  '--toToken',
  req.toToken,
  ...(req.slippage ? ['--slippage', req.slippage] : []),
];

interface QuoteData {
  fromCoinSymbol: string;
  fromCoinAmount: string;
  toCoinSymbol: string;
  toCoinAmount: string;
  slippage?: number;
}
interface ListData {
  list: { orderId: string; status: OrderStatus; txHash: string | null }[];
}

export function createAgenticWalletAdapter(run: BawRunner = runBaw): ExecutionAdapter {
  return {
    name: 'agentic-wallet',

    async quote(req) {
      const d = await call<QuoteData>(run, ['market-order', 'quote', ...swapArgs(req)]);
      const quote: AdapterQuote = {
        fromSymbol: d.fromCoinSymbol,
        fromAmount: Number(d.fromCoinAmount),
        toSymbol: d.toCoinSymbol,
        toAmount: Number(d.toCoinAmount),
        slippage: d.slippage ?? null,
        raw: d,
      };
      return quote;
    },

    async swap(req) {
      const d = await call<{ orderId: string }>(run, ['market-order', 'swap', ...swapArgs(req)]);
      if (!d?.orderId) throw new ExecutionError('baw market-order swap', 'NO_ORDER_ID', 'NO_ORDER_ID', 'baw returned success without an orderId', d);
      return { orderId: String(d.orderId), raw: d };
    },

    async status(orderId): Promise<OrderState> {
      const d = await call<ListData>(run, ['market-order', 'list', '--orderId', orderId]);
      const order = d.list?.find((o) => String(o.orderId) === orderId);
      if (!order) throw new ExecutionError('baw market-order list', 'ORDER_NOT_FOUND', 'ORDER_NOT_FOUND', `No market order ${orderId}`, d);
      return { orderId, status: order.status, txHash: order.txHash ?? null, raw: order };
    },
  };
}
