import { describe, expect, it } from 'vitest';
import { instruments } from '.';
import { resolveInstrument } from './resolve';

const resolve = (q: string) => resolveInstrument(instruments, q);

describe('resolveInstrument', () => {
  it('resolves bare tickers in any case', () => {
    expect(resolve('NVDA')?.instrument.id).toBe('US:NVDA');
    expect(resolve('mstr')?.instrument.id).toBe('US:MSTR');
    expect(resolve('NVDA')?.matchedOn).toBe('ticker');
  });

  it('resolves instrument ids', () => {
    expect(resolve('US:TSLA')?.instrument.id).toBe('US:TSLA');
  });

  it('resolves issuer symbols to the instrument and the venue', () => {
    const r = resolve('NVDAon');
    expect(r?.instrument.id).toBe('US:NVDA');
    expect(r?.venue?.issuer).toBe('ondo');
    expect(resolve('nvdab')?.venue?.issuer).toBe('bstocks');
    expect(resolve('QQQx')?.venue?.issuer).toBe('xstocks');
  });

  it('resolves contract addresses in any case', () => {
    const venue = instruments[0]!.venues[1]!;
    const r = resolve(venue.address.toUpperCase().replace('0X', '0x'));
    expect(r?.venue?.symbol).toBe(venue.symbol);
    expect(r?.matchedOn).toBe('address');
  });

  it('resolves company names and aliases', () => {
    expect(resolve('nvidia')?.instrument.id).toBe('US:NVDA');
    expect(resolve('Tesla')?.instrument.id).toBe('US:TSLA');
    expect(resolve('MicroStrategy')?.instrument.id).toBe('US:MSTR');
    expect(resolve('Nasdaq 100')?.instrument.id).toBe('US:QQQ');
    expect(resolve('circle internet')?.instrument.id).toBe('US:CRCL');
  });

  it('returns null for anything outside the registry', () => {
    expect(resolve('AAPL')).toBeNull();
    expect(resolve('')).toBeNull();
    expect(resolve('0x0000000000000000000000000000000000000000')).toBeNull();
    expect(resolve('ni')).toBeNull();
  });
});
