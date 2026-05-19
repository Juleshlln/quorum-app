import type { Database } from '@/types/database';

export type SourcesTab = 'domains' | 'urls';
export type DomainType = 'Editorial' | 'Corporate' | 'UGC' | 'Institutional' | 'Other';
export type UrlType = 'Homepage' | 'Article' | 'CategoryPage' | 'Profile' | 'Discussion' | 'HowToGuide' | 'Listicle' | 'Other';

export type SourcesFilters = {
  rangeDays: number;
  topicId?: string | null;
  model?: string | null;
  owned?: 'all' | 'owned' | 'earned';
  search?: string;
  gapOnly?: boolean;
  tab: SourcesTab;
};

type CitationRow = {
  id: string;
  cited_at: string;
  ai_model: string | null;
  brand_mentioned: boolean;
  competitor_mentioned: boolean | null;
  position_in_answer: number | null;
  method?: string | null;
  confidence?: number | null;
  domain: { domain: string; domain_type: string; is_owned: boolean; category?: string | null } | null;
  url: { url: string; url_type: string } | null;
  prompt_run_id: string;
};

const TYPE_WEIGHTS: Record<string, number> = {
  Institutional: 1.0,
  Editorial: 0.9,
  Corporate: 0.8,
  UGC: 0.6,
  Other: 0.5,
};

export function computeQualityScore({
  type,
  distinctDays,
  usedTotal,
  lastSeenDays,
  rangeDays,
}: {
  type: string;
  distinctDays: number;
  usedTotal: number;
  lastSeenDays: number;
  rangeDays: number;
}) {
  const typeWeight = TYPE_WEIGHTS[type] ?? 0.5;
  const stability = Math.min(1, distinctDays / Math.max(1, rangeDays));
  const volume = Math.min(1, usedTotal / 20);
  const freshness = 1 - Math.min(1, lastSeenDays / 30);
  const score = Math.round(100 * (0.4 * typeWeight + 0.2 * stability + 0.25 * volume + 0.15 * freshness));
  return Math.max(0, Math.min(100, score));
}

export function buildSourcesAggregations({
  citations,
  rangeDays,
  tab,
  gapOnly,
}: {
  citations: CitationRow[];
  rangeDays: number;
  tab: SourcesTab;
  gapOnly?: boolean;
}) {
  const totalCitations = citations.length;
  const uniqueDomains = new Set(citations.map((c) => c.domain?.domain).filter(Boolean)).size;
  const uniqueUrls = new Set(citations.map((c) => c.url?.url).filter(Boolean)).size;
  const observedCitations = citations.filter((c) => (c.method || 'observed') === 'observed').length;
  const probableCitations = citations.filter((c) => (c.method || 'observed') === 'probable').length;
  const ownedCitations = citations.filter((c) => c.domain?.category === 'owned' || c.domain?.is_owned).length;
  const competitorCitations = citations.filter((c) => c.domain?.category === 'competitor').length;
  const thirdPartyCitations = citations.filter((c) => c.domain?.category === 'third_party' || !c.domain?.category).length;
  const ownedShare = totalCitations > 0 ? Math.round((ownedCitations / totalCitations) * 100) : 0;
  const competitorShare = totalCitations > 0 ? Math.round((competitorCitations / totalCitations) * 100) : 0;
  const thirdPartyShare = totalCitations > 0 ? Math.round((thirdPartyCitations / totalCitations) * 100) : 0;

  const byDate = new Map<string, number>();
  citations.forEach((c) => {
    const date = c.cited_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });
  const series = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total_citations: total }));

  const typeBreakdown = new Map<string, number>();
  citations.forEach((c) => {
    const key = tab === 'domains' ? c.domain?.domain_type : c.url?.url_type;
    if (!key) return;
    typeBreakdown.set(key, (typeBreakdown.get(key) || 0) + 1);
  });
  const breakdown = Array.from(typeBreakdown.entries()).map(([type, count]) => ({
    type,
    count,
    share: totalCitations > 0 ? Math.round((count / totalCitations) * 100) : 0,
  }));

  const groupMap = new Map<string, {
    key: string;
    type: string;
    is_owned: boolean;
    used_total: number;
    observed_total: number;
    probable_total: number;
    runs: Set<string>;
    mentions: number;
    last_seen: string;
    distinct_days: Set<string>;
  }>();

  citations.forEach((c) => {
    const key = tab === 'domains' ? c.domain?.domain : c.url?.url;
    if (!key) return;
    const type = tab === 'domains' ? c.domain?.domain_type || 'Other' : c.url?.url_type || 'Other';
    const isOwned = c.domain?.is_owned ?? false;
    const existing = groupMap.get(key) || {
      key,
      type,
      is_owned: isOwned,
      used_total: 0,
      observed_total: 0,
      probable_total: 0,
      runs: new Set<string>(),
      mentions: 0,
      last_seen: c.cited_at,
      distinct_days: new Set<string>(),
    };
    existing.used_total += 1;
    if ((c.method || 'observed') === 'observed') existing.observed_total += 1;
    if ((c.method || 'observed') === 'probable') existing.probable_total += 1;
    existing.runs.add(c.prompt_run_id);
    if (c.brand_mentioned) existing.mentions += 1;
    if (c.cited_at > existing.last_seen) existing.last_seen = c.cited_at;
    existing.distinct_days.add(c.cited_at.slice(0, 10));
    groupMap.set(key, existing);
  });

  const now = new Date();
  const rows = Array.from(groupMap.values()).map((row) => {
    const lastSeenDays = Math.round((now.getTime() - new Date(row.last_seen).getTime()) / (1000 * 60 * 60 * 24));
    const quality_score = computeQualityScore({
      type: row.type,
      distinctDays: row.distinct_days.size,
      usedTotal: row.used_total,
      lastSeenDays,
      rangeDays,
    });
    const brandRate = row.used_total > 0 ? Math.round((row.mentions / row.used_total) * 100) : 0;
    return {
      key: row.key,
      type: row.type,
      is_owned: row.is_owned,
      used_total: row.used_total,
      used_share: totalCitations > 0 ? Math.round((row.used_total / totalCitations) * 100) : 0,
      observed_share: row.used_total > 0 ? Math.round((row.observed_total / row.used_total) * 100) : 0,
      probable_share: row.used_total > 0 ? Math.round((row.probable_total / row.used_total) * 100) : 0,
      avg_citations_per_run: row.runs.size > 0 ? Number((row.used_total / row.runs.size).toFixed(2)) : 0,
      last_seen: row.last_seen,
      brand_mentioned_rate: brandRate,
      quality_score,
      opportunity: !row.is_owned && brandRate < 20,
    };
  });

  const table = rows.filter((row) => !gapOnly || row.opportunity);

  const avgQuality = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.quality_score, 0) / rows.length)
    : 0;

  return {
    kpis: {
      total_citations: totalCitations,
      unique_domains: uniqueDomains,
      unique_urls: uniqueUrls,
      owned_share: ownedShare,
      competitor_share: competitorShare,
      third_party_share: thirdPartyShare,
      avg_quality_score: avgQuality,
      observed_citations: observedCitations,
      probable_citations: probableCitations,
    },
    series,
    breakdown,
    table,
  };
}

export type SourcesResponse = ReturnType<typeof buildSourcesAggregations>;
