import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export interface TapeConfig {
  dbPath: string;
  intervalSec: number;
  apiKey: string | undefined;
  apiSecret: string | undefined;
  baseUrl: string | undefined;
  quoteWallet: string | undefined;
}

/** Reads the environment. Relative TAPE_DB_PATH resolves against the repo root. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): TapeConfig {
  const dbPath = env.TAPE_DB_PATH ?? './data/tape.sqlite';
  const intervalSec = Number(env.TAPE_INTERVAL_SEC ?? 300);
  if (!Number.isInteger(intervalSec) || intervalSec < 60) throw new Error(`TAPE_INTERVAL_SEC must be an integer >= 60, got ${env.TAPE_INTERVAL_SEC}`);
  return {
    dbPath: isAbsolute(dbPath) ? dbPath : resolve(REPO_ROOT, dbPath),
    intervalSec,
    apiKey: env.BINANCE_WEB3_API_KEY || undefined,
    apiSecret: env.BINANCE_WEB3_API_SECRET || undefined,
    baseUrl: env.BINANCE_WEB3_BASE_URL || undefined,
    quoteWallet: env.TAPE_QUOTE_WALLET || undefined,
  };
}
