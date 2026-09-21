import { describe, expect, it } from 'vitest';
import { sign } from './sign';

// Expected values computed independently with:
// printf '%s' '<prehash>' | openssl dgst -sha256 -hmac 'test-secret' -binary | base64
describe('sign', () => {
  const timestamp = '2026-09-21T13:30:00.000Z';

  it('signs a GET with the /build prefix and the encoded query string', () => {
    expect(
      sign({
        secret: 'test-secret',
        timestamp,
        method: 'GET',
        requestPath: '/build/api/v1/dex/market/rwa/price?binanceChainId=56&tokenContractAddresses=0xabc%2C0xdef',
        body: '',
      }),
    ).toBe('wjtNMDtei+B38yF65zwYidD2dNaY46oL0Whw/APExLE=');
  });

  it('signs a POST including the body', () => {
    expect(
      sign({
        secret: 'test-secret',
        timestamp,
        method: 'post',
        requestPath: '/build/api/v1/dex/market/price',
        body: '[{"binanceChainId":"56","tokenContractAddress":"0xabc"}]',
      }),
    ).toBe('4Q20JAnQYDAVl8KnSlkruj+N1Vibv0DdcbHGsUXceEU=');
  });
});
