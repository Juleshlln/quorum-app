import { describe, it, expect } from 'vitest';
import { getDomainFromUrl, normalizeDomain, normalizeUrl } from './normalize';

describe('normalizeUrl', () => {
  it('strips tracking params and normalizes protocol/host', () => {
    const input = 'http://WWW.Example.com/path/?utm_source=google&ref=abc&id=1#section';
    const result = normalizeUrl(input);
    expect(result).toBe('https://example.com/path?id=1');
  });

  it('removes trailing slash on non-root paths', () => {
    const input = 'https://example.com/path/';
    const result = normalizeUrl(input);
    expect(result).toBe('https://example.com/path');
  });
});

describe('getDomainFromUrl', () => {
  it('extracts registrable domains', () => {
    expect(getDomainFromUrl('https://blog.example.co.uk/page')).toBe('example.co.uk');
  });
});

describe('normalizeDomain', () => {
  it('removes leading www and lowercases', () => {
    expect(normalizeDomain('WWW.Example.com')).toBe('example.com');
  });
});
