/** A market swap on BSC. Quantities are human-readable decimal strings, as `baw` takes them. */
export interface SwapRequest {
  fromToken: `0x${string}`;
  toToken: `0x${string}`;
  fromTokenQty: string;
  /** "auto" or a percentage 0 to 100. */
  slippage?: string;
}

export interface AdapterQuote {
  fromSymbol: string;
  fromAmount: number;
  toSymbol: string;
  toAmount: number;
  /** Fraction, e.g. 0.01 for 1%. */
  slippage: number | null;
  raw: unknown;
}

export type OrderStatus = 'PENDING' | 'FINISHED' | 'FAILED';

export interface OrderState {
  orderId: string;
  status: OrderStatus;
  txHash: string | null;
  raw: unknown;
}

/** A wallet error returned as data: `code`/`name`/`message` exactly as the wallet gave them. */
export class ExecutionError extends Error {
  constructor(
    readonly command: string,
    readonly code: string,
    readonly errorName: string,
    message: string,
    readonly raw: unknown,
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

/**
 * One interface, two implementations (SPEC 5): AgenticWalletAdapter (baw) now, DirectSignerAdapter (viem) if needed.
 * Signing lives only behind this interface, and only the local MCP server's execute_route calls swap().
 */
export interface ExecutionAdapter {
  readonly name: 'agentic-wallet' | 'direct';
  quote(req: SwapRequest): Promise<AdapterQuote>;
  /** Submits the swap. An orderId is not a fill: poll status() to FINISHED or FAILED. */
  swap(req: SwapRequest): Promise<{ orderId: string; raw: unknown }>;
  status(orderId: string): Promise<OrderState>;
}
