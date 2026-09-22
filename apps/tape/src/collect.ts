import {
  APRO_FEEDS_BSC,
  readAproFeed,
  readMultiplier,
  Web3ApiError,
  type MultiplierReading,
  type OracleReading,
  type Web3Client,
  type Web3Response,
} from '@oneticker/clients';
import { isRwaVenue, type Instrument, type Venue } from '@oneticker/core';
import type { PublicClient } from 'viem';

const BSC = '56';
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD, 18 decimals
export const NOTIONALS_USD = [100, 1_000, 10_000] as const;

/** One call as stored in raw_json: the envelope on success, the error otherwise. */
export type Captured =
  | { at: string; ok: true; envelope: unknown }
  | { at: string; ok: false; httpStatus: number; code: string; message: string; response: unknown };

export interface VenueResult {
  instrument: Instrument;
  venue: Venue;
  /** Parsed on-chain surfaces (bStocks only). null when the venue has none or the read failed. */
  oracle: OracleReading | null;
  multiplier: MultiplierReading | null;
  raw: {
    rwaPrice: Captured | null;
    marketPrice: Captured | null;
    underlyingMarket: Captured | null;
    quotes: Record<string, Captured>;
    oracle: OracleReading | { error: string } | null;
    multiplier: MultiplierReading | { error: string } | null;
  };
}

export type Collect = (instruments: readonly Instrument[]) => Promise<VenueResult[]>;

async function capture(call: () => Promise<Web3Response<unknown>>): Promise<Captured> {
  const at = new Date().toISOString();
  try {
    return { at, ok: true, envelope: (await call()).envelope };
  } catch (error) {
    if (!(error instanceof Web3ApiError)) throw error;
    return { at, ok: false, httpStatus: error.httpStatus, code: error.code, message: error.message, response: error.raw };
  }
}

const noKeys = (): Captured => ({ at: new Date().toISOString(), ok: false, httpStatus: 0, code: 'NO_API_KEYS', message: 'BINANCE_WEB3_API_KEY and BINANCE_WEB3_API_SECRET are not set', response: null });

export interface CollectorOptions {
  /** null until API keys are configured; Web3 surfaces are then recorded as NO_API_KEYS errors. */
  web3: Web3Client | null;
  chain: PublicClient | null;
  /** Receiver for RFQ quotes (Ondo, bStocks); the hot wallet address. */
  quoteWallet?: string;
  now?: () => Date;
}

/**
 * Raw collection for one run: one batched rwa/price, underlying-market per RWA venue, a USDT buy quote at each
 * notional for every venue, and for bStocks the APRO oracle and BEP-677 multiplier from BSC. Failures of any
 * single surface are data, not exceptions.
 */
export function createCollector({ web3, chain, quoteWallet, now = () => new Date() }: CollectorOptions): Collect {
  const get = (endpoint: string, query: Record<string, string | undefined>) => (web3 ? capture(() => web3.get(endpoint, query)) : Promise.resolve(noKeys()));
  const post = (endpoint: string, body: unknown) => (web3 ? capture(() => web3.post(endpoint, body)) : Promise.resolve(noKeys()));

  return async (instruments) => {
    const venues = instruments.flatMap((instrument) => instrument.venues.map((venue) => ({ instrument, venue })));
    const rwaAddresses = venues.filter(({ venue }) => isRwaVenue(venue)).map(({ venue }) => venue.address);
    const rwaPrice = rwaAddresses.length > 0 ? await get('/api/v1/dex/market/rwa/price', { binanceChainId: BSC, tokenContractAddresses: rwaAddresses.join(',') }) : null;
    // Batched last-trade price for every venue; the only on-chain price source for xStocks.
    const marketPrice = await post('/api/v1/dex/market/price', venues.map(({ venue }) => ({ binanceChainId: BSC, tokenContractAddress: venue.address })));

    const results: VenueResult[] = [];
    for (const { instrument, venue } of venues) {
      const rwa = isRwaVenue(venue);
      const underlyingMarket = rwa ? await get('/api/v1/dex/market/rwa/underlying-market', { binanceChainId: BSC, tokenContractAddress: venue.address }) : null;

      const quotes: Record<string, Captured> = {};
      for (const usd of NOTIONALS_USD) {
        quotes[usd] = await get('/api/v1/dex/aggregator/quote', {
          binanceChainId: BSC,
          amount: (BigInt(usd) * 10n ** 18n).toString(),
          fromTokenAddress: USDT_BSC,
          toTokenAddress: venue.address,
          userWalletAddress: quoteWallet,
        });
      }

      let oracle: OracleReading | null = null;
      let multiplier: MultiplierReading | null = null;
      let rawOracle: VenueResult['raw']['oracle'] = null;
      let rawMultiplier: VenueResult['raw']['multiplier'] = null;
      if (chain && venue.issuer === 'bstocks') {
        const feed = APRO_FEEDS_BSC[venue.symbol];
        if (feed) {
          try {
            oracle = await readAproFeed(chain, feed, now());
            rawOracle = oracle;
          } catch (error) {
            rawOracle = { error: String(error) };
          }
        }
        try {
          multiplier = await readMultiplier(chain, venue.address, now());
          rawMultiplier = multiplier;
        } catch (error) {
          rawMultiplier = { error: String(error) };
        }
      }

      results.push({ instrument, venue, oracle, multiplier, raw: { rwaPrice: rwa ? rwaPrice : null, marketPrice, underlyingMarket, quotes, oracle: rawOracle, multiplier: rawMultiplier } });
    }
    return results;
  };
}
