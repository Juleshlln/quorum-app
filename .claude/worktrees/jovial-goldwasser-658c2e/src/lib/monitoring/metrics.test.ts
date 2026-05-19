import { describe, it, expect } from 'vitest';
import { buildSourcesSummary, validateShares } from '@/lib/monitoring/metrics';

describe('buildSourcesSummary', () => {
  it('computes stable shares and totals', () => {
    const rows = [
      { cited_at: '2026-02-01T10:00:00Z', method: 'observed', domain: { domain: 'brand.com', category: 'owned' }, url: { url: 'https://brand.com' } },
      { cited_at: '2026-02-01T10:00:00Z', method: 'observed', domain: { domain: 'competitor.com', category: 'competitor' }, url: { url: 'https://competitor.com' } },
      { cited_at: '2026-02-02T10:00:00Z', method: 'probable', domain: { domain: 'news.com', category: 'third_party' }, url: { url: 'https://news.com/article' } },
    ];

    const metrics = buildSourcesSummary(rows as any);
    expect(metrics.total_citations).toBe(3);
    expect(metrics.unique_domains).toBe(3);
    expect(metrics.unique_urls).toBe(3);
    expect(metrics.observed_citations).toBe(2);
    expect(metrics.probable_citations).toBe(1);
    expect(metrics.owned_citations).toBe(1);
    expect(metrics.competitor_citations).toBe(1);
    expect(metrics.third_party_citations).toBe(1);
    expect(validateShares(metrics)).toBe(true);
  });
});
