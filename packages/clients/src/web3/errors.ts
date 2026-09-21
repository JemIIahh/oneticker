/** Codes we assign ourselves when there is no API error code to report. */
export type LocalErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'NON_JSON' | 'HTTP_ERROR';

export class Web3ApiError extends Error {
  override readonly name = 'Web3ApiError';

  constructor(
    readonly endpoint: string,
    readonly httpStatus: number,
    /** API error code as a string (e.g. "40369"), or a LocalErrorCode. */
    readonly code: string,
    message: string,
    /** Parsed response body, or raw text when it was not JSON. */
    readonly raw: unknown,
  ) {
    super(`${endpoint}: ${code} ${message}`);
  }
}
