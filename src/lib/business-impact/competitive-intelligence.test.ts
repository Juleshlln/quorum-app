import { describe, expect, it } from 'vitest';
import { buildCompetitiveIntelligence } from '@/lib/business-impact/competitive-intelligence';

describe('buildCompetitiveIntelligence', () => {
  it('computes answer share, clickable surface and opportunities', () => {
    const result = buildCompetitiveIntelligence({
      brandName: 'Quorum',
      competitors: [{ id: 'comp-1', name: 'CompetitorX' }],
      runs: [
        {
          id: 'run-1',
          date: '2026-03-01',
          promptId: 'prompt-1',
          promptText: 'Best GEO platform',
          topicId: 'topic-1',
          topicName: 'GEO',
          brandMentioned: true,
          competitorsMentioned: ['CompetitorX'],
        },
        {
          id: 'run-2',
          date: '2026-03-02',
          promptId: 'prompt-1',
          promptText: 'Best GEO platform',
          topicId: 'topic-1',
          topicName: 'GEO',
          brandMentioned: false,
          competitorsMentioned: ['CompetitorX'],
        },
      ],
      citations: [
        {
          promptRunId: 'run-1',
          date: '2026-03-01',
          domain: 'quorum.com',
          category: 'owned',
          isOwned: true,
          competitorId: null,
          url: 'https://quorum.com',
        },
        {
          promptRunId: 'run-1',
          date: '2026-03-01',
          domain: 'g2.com',
          category: 'third_party',
          isOwned: false,
          competitorId: null,
          url: 'https://g2.com/quorum',
        },
        {
          promptRunId: 'run-2',
          date: '2026-03-02',
          domain: 'competitorx.com',
          category: 'competitor',
          isOwned: false,
          competitorId: 'comp-1',
          url: 'https://competitorx.com',
        },
        {
          promptRunId: 'run-2',
          date: '2026-03-02',
          domain: 'g2.com',
          category: 'third_party',
          isOwned: false,
          competitorId: null,
          url: 'https://g2.com/competitorx',
        },
      ],
    });

    expect(result.shareOfAnswer.find((entry) => entry.brand === 'Quorum')?.share).toBe(50);
    expect(result.shareOfClickableSurface.brand).toBe(25);
    expect(result.shareOfClickableSurface.competitors).toBe(25);
    expect(result.competitorSourceOverlap[0]?.overlap).toBe(50);
    expect(result.opportunityGapSummary.length).toBeGreaterThan(0);
  });
});
