import { describe, expect, it } from 'vitest';
import { buildAttributionEvents } from '@/lib/business-impact/attribution';

describe('buildAttributionEvents', () => {
  it('separates observed AI sessions from assisted lift', () => {
    const events = buildAttributionEvents({
      citations: [
        {
          date: '2026-03-03',
          model: 'gpt-4o',
          promptId: 'prompt-1',
          topicId: 'topic-1',
          citedUrl: 'https://brand.com/pricing',
          citedDomain: 'brand.com',
          citationCount: 2,
          visibilityScore: 80,
        },
      ],
      trafficMetrics: [
        {
          date: '2026-03-01',
          pageUrl: 'https://brand.com/pricing',
          source: 'google',
          medium: 'organic',
          sessions: 10,
          users: 9,
          engagedSessions: 8,
          conversions: 1,
          revenue: 100,
        },
        {
          date: '2026-03-02',
          pageUrl: 'https://brand.com/pricing',
          source: 'google',
          medium: 'organic',
          sessions: 12,
          users: 10,
          engagedSessions: 9,
          conversions: 1,
          revenue: 110,
        },
        {
          date: '2026-03-03',
          pageUrl: 'https://brand.com/pricing',
          source: 'chatgpt.com',
          medium: 'referral',
          sessions: 8,
          users: 8,
          engagedSessions: 7,
          conversions: 2,
          revenue: 200,
        },
        {
          date: '2026-03-03',
          pageUrl: 'https://brand.com/pricing',
          source: 'google',
          medium: 'organic',
          sessions: 20,
          users: 18,
          engagedSessions: 15,
          conversions: 2,
          revenue: 220,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0].observedAiSessions).toBe(8);
    expect(events[0].assistedSessionsEstimate).toBeGreaterThan(6);
    expect(events[0].conversionsObserved).toBeCloseTo(1.14, 2);
    expect(events[0].attributionConfidence).toBe('high');
  });
});
