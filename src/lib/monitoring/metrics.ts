export type CitationMetricRow = {
  cited_at: string;
  method?: string | null;
  domain?: { domain: string | null; category?: string | null; is_owned?: boolean | null } | null;
  url?: { url: string | null } | null;
};

export type SourcesSummaryMetrics = {
  total_citations: number;
  unique_domains: number;
  unique_urls: number;
  observed_citations: number;
  probable_citations: number;
  owned_citations: number;
  competitor_citations: number;
  third_party_citations: number;
  owned_share: number;
  competitor_share: number;
  third_party_share: number;
  series: Array<{ date: string; total_citations: number }>;
};

export function buildSourcesSummary(citations: CitationMetricRow[]): SourcesSummaryMetrics {
  const total = citations.length;
  const uniqueDomains = new Set(citations.map((c) => c.domain?.domain).filter(Boolean)).size;
  const uniqueUrls = new Set(citations.map((c) => c.url?.url).filter(Boolean)).size;
  const observed = citations.filter((c) => (c.method || 'observed') === 'observed').length;
  const probable = citations.filter((c) => (c.method || 'observed') === 'probable').length;
  const owned = citations.filter((c) => c.domain?.category === 'owned' || c.domain?.is_owned).length;
  const competitor = citations.filter((c) => c.domain?.category === 'competitor').length;
  const thirdParty = citations.filter((c) => c.domain?.category === 'third_party' || !c.domain?.category).length;

  const byDate = new Map<string, number>();
  citations.forEach((c) => {
    const date = c.cited_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });
  const series = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, total_citations: count }));

  return {
    total_citations: total,
    unique_domains: uniqueDomains,
    unique_urls: uniqueUrls,
    observed_citations: observed,
    probable_citations: probable,
    owned_citations: owned,
    competitor_citations: competitor,
    third_party_citations: thirdParty,
    owned_share: total > 0 ? Math.round((owned / total) * 100) : 0,
    competitor_share: total > 0 ? Math.round((competitor / total) * 100) : 0,
    third_party_share: total > 0 ? Math.round((thirdParty / total) * 100) : 0,
    series,
  };
}

export function validateShares(metrics: SourcesSummaryMetrics, tolerance = 2) {
  const total = metrics.owned_share + metrics.competitor_share + metrics.third_party_share;
  return Math.abs(100 - total) <= tolerance;
}
