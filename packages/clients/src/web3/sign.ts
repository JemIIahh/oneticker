import { createHmac } from 'node:crypto';

export interface SignInput {
  secret: string;
  timestamp: string;
  method: string;
  /** Path as sent, including the `/build` prefix and the encoded query string. */
  requestPath: string;
  body: string;
}

/** base64(HMAC-SHA256(secret, timestamp + METHOD + requestPath + body)) for the `X-OC-SIGN` header. */
export function sign({ secret, timestamp, method, requestPath, body }: SignInput): string {
  return createHmac('sha256', secret)
    .update(timestamp + method.toUpperCase() + requestPath + body)
    .digest('base64');
}
