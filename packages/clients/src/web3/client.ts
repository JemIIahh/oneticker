import { SlidingWindowLimiter } from './limiter';
import { Web3ApiError } from './errors';
import { sign } from './sign';

export const DEFAULT_BASE_URL = 'https://web3.binance.com/build';

/**
 * Response envelope. Field names are provisional until fixtures confirm them:
 * our notes say `message` and `success`, the official connector reads `msg`.
 */
export interface Envelope<T = unknown> {
  code?: string | number;
  message?: string;
  msg?: string;
  success?: boolean;
  data?: T;
  timestamp?: string | number;
}

/** One row of the Tape's `api_calls` table. */
export interface ApiCall {
  ts: string;
  method: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  errorCode: string | null;
  bytes: number;
}

export interface Web3Response<T> {
  data: T;
  envelope: Envelope<T>;
  httpStatus: number;
  latencyMs: number;
}

export type Query = Record<string, string | number | boolean | undefined>;

export interface Web3ClientOptions {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  onCall?: (call: ApiCall) => void;
  /** Per-endpoint limit. The API allows 5 req/s per endpoint. */
  perEndpointPerSec?: number;
  /** Per-key limit. The API allows 1,200 req/min per key and per IP. */
  perMinute?: number;
  /** Retries after a 429. */
  maxRetries?: number;
  timeoutMs?: number;
}

export interface Web3Client {
  get<T>(endpoint: string, query?: Query): Promise<Web3Response<T>>;
  post<T>(endpoint: string, body: unknown, query?: Query): Promise<Web3Response<T>>;
}

export function isSuccess(envelope: Envelope): boolean {
  if (typeof envelope.success === 'boolean') return envelope.success;
  return envelope.code !== undefined && Number(envelope.code) === 0;
}

export function createWeb3Client(options: Web3ClientOptions): Web3Client {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;
  const perEndpointPerSec = options.perEndpointPerSec ?? 5;
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const keyLimiter = new SlidingWindowLimiter(options.perMinute ?? 1200, 60_000);
  const endpointLimiters = new Map<string, SlidingWindowLimiter>();

  function limiterFor(endpoint: string): SlidingWindowLimiter {
    let limiter = endpointLimiters.get(endpoint);
    if (!limiter) {
      limiter = new SlidingWindowLimiter(perEndpointPerSec, 1000);
      endpointLimiters.set(endpoint, limiter);
    }
    return limiter;
  }

  async function request<T>(method: 'GET' | 'POST', endpoint: string, query?: Query, body?: unknown): Promise<Web3Response<T>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.append(key, String(value));
    }
    const search = params.size > 0 ? `?${params.toString()}` : '';
    const bodyString = body === undefined ? '' : JSON.stringify(body);

    for (let attempt = 0; ; attempt++) {
      await limiterFor(endpoint).acquire();
      await keyLimiter.acquire();

      const timestamp = new Date().toISOString();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-OC-APIKEY': options.apiKey,
        'X-OC-TIMESTAMP': timestamp,
        'X-OC-SIGN': sign({ secret: options.apiSecret, timestamp, method, requestPath: basePath + endpoint + search, body: bodyString }),
      };
      if (bodyString) headers['Content-Type'] = 'application/json';

      const started = performance.now();
      const record = (httpStatus: number, errorCode: string | null, bytes: number): number => {
        const latencyMs = Math.round(performance.now() - started);
        options.onCall?.({ ts: timestamp, method, endpoint, httpStatus, latencyMs, errorCode, bytes });
        return latencyMs;
      };

      let response: Response;
      let text: string;
      try {
        response = await doFetch(baseUrl + endpoint + search, {
          method,
          headers,
          ...(bodyString ? { body: bodyString } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        });
        text = await response.text();
      } catch (error) {
        const code = error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR';
        record(0, code, 0);
        throw new Web3ApiError(endpoint, 0, code, error instanceof Error ? error.message : String(error), null);
      }

      const bytes = Buffer.byteLength(text);
      let envelope: Envelope<T>;
      try {
        envelope = JSON.parse(text) as Envelope<T>;
      } catch {
        record(response.status, 'NON_JSON', bytes);
        throw new Web3ApiError(endpoint, response.status, 'NON_JSON', `HTTP ${response.status}, body is not JSON`, text);
      }

      if (response.status === 429 && attempt < maxRetries) {
        record(429, envelope.code === undefined ? '429' : String(envelope.code), bytes);
        const retryAfterSec = Number(response.headers.get('retry-after'));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 1000));
        continue;
      }

      if (!response.ok || !isSuccess(envelope)) {
        const code = envelope.code !== undefined ? String(envelope.code) : 'HTTP_ERROR';
        record(response.status, code, bytes);
        throw new Web3ApiError(endpoint, response.status, code, envelope.message ?? envelope.msg ?? `HTTP ${response.status}`, envelope);
      }

      const latencyMs = record(response.status, null, bytes);
      return { data: envelope.data as T, envelope, httpStatus: response.status, latencyMs };
    }
  }

  return {
    get: (endpoint, query) => request('GET', endpoint, query),
    post: (endpoint, body, query) => request('POST', endpoint, query, body),
  };
}
