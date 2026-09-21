import { Web3ApiError, type Web3Client, type Web3Response } from '@oneticker/clients';
import { isRwaVenue, type Instrument, type Venue } from '@oneticker/core';

const BSC = '56';
const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD, 18 decimals
export const NOTIONALS_USD = [100, 1_000, 10_000] as const;

/** One API call as stored in raw_json: the envelope on success, the error otherwise. */
export type Captured =
  | { at: string; ok: true; envelope: unknown }
  | { at: string; ok: false; httpStatus: number; code: string; message: string; response: unknown };

export interface VenueResult {
  instrument: Instrument;
  venue: Venue;
  raw: {
    rwaPrice: Captured | null;
    underlyingMarket: Captured | null;
    quotes: Record<string, Captured>;
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

export interface CollectorOptions {
  web3: Web3Client;
  /** Receiver for RFQ quotes (Ondo, bStocks); the hot wallet address. */
  quoteWallet?: string;
}

/**
 * Raw collection for one run: one batched rwa/price, underlying-market per RWA venue, and a USDT buy quote at
 * each notional for every venue. API errors are data (e.g. 40369 off-hours) and are kept, not thrown.
 */
export function createCollector({ web3, quoteWallet }: CollectorOptions): Collect {
  return async (instruments) => {
    const venues = instruments.flatMap((instrument) => instrument.venues.map((venue) => ({ instrument, venue })));
    const rwaAddresses = venues.filter(({ venue }) => isRwaVenue(venue)).map(({ venue }) => venue.address);

    const rwaPrice =
      rwaAddresses.length > 0
        ? await capture(() => web3.get('/api/v1/dex/market/rwa/price', { binanceChainId: BSC, tokenContractAddresses: rwaAddresses.join(',') }))
        : null;

    const results: VenueResult[] = [];
    for (const { instrument, venue } of venues) {
      const rwa = isRwaVenue(venue);
      const underlyingMarket = rwa
        ? await capture(() => web3.get('/api/v1/dex/market/rwa/underlying-market', { binanceChainId: BSC, tokenContractAddress: venue.address }))
        : null;

      const quotes: Record<string, Captured> = {};
      for (const usd of NOTIONALS_USD) {
        quotes[usd] = await capture(() =>
          web3.get('/api/v1/dex/aggregator/quote', {
            binanceChainId: BSC,
            amount: (BigInt(usd) * 10n ** 18n).toString(),
            fromTokenAddress: USDT_BSC,
            toTokenAddress: venue.address,
            userWalletAddress: quoteWallet,
          }),
        );
      }

      results.push({ instrument, venue, raw: { rwaPrice: rwa ? rwaPrice : null, underlyingMarket, quotes } });
    }
    return results;
  };
}
