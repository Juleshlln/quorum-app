import type { AttributionComputationRow, AttributionConfidence, AttributionInputCitation, DailyPageMetric } from '@/lib/business-impact/types';
import { AI_TRAFFIC_DETECTION_VERSION, classifyTrafficSource } from '@/lib/business-impact/traffic-classification';
import { canonicalizePageUrl, getCitedDomain, getPagePathKey } from '@/lib/business-impact/url';
import { clamp, round } from '@/lib/business-impact/math';

function buildAttributionKey(citation: {
  date: string;
  model: string | null;
  promptId: string | null;
  topicId: string | null;
  citedUrl: string;
}) {
  return [
    citation.date,
    citation.model || '',
    citation.promptId || '',
    citation.topicId || '',
    citation.citedUrl,
  ].join('::');
}

type GroupedCitationAccumulator = {
  date: string;
  model: string | null;
  promptId: string | null;
  topicId: string | null;
  citedUrl: string;
  citedDomain: string | null;
  citationCount: number;
  visibilityValues: number[];
};

export function groupCitationsForAttribution(
  citations: Array<{
    date: string;
    model: string | null;
    promptId: string | null;
    topicId: string | null;
    citedUrl: string;
    citedDomain?: string | null;
    visibilityScore?: number | null;
  }>,
) {
  const groups = new Map<string, GroupedCitationAccumulator>();

  for (const citation of citations) {
    const key = buildAttributionKey(citation);
    const current = groups.get(key) || {
      date: citation.date,
      model: citation.model,
      promptId: citation.promptId,
      topicId: citation.topicId,
      citedUrl: citation.citedUrl,
      citedDomain: citation.citedDomain || getCitedDomain(citation.citedUrl),
      citationCount: 0,
      visibilityValues: [],
    };

    current.citationCount += 1;
    if (typeof citation.visibilityScore === 'number' && Number.isFinite(citation.visibilityScore)) {
      current.visibilityValues.push(citation.visibilityScore);
    }
    groups.set(key, current);
  }

  return Array.from(groups.values()).map<AttributionInputCitation>((group) => ({
    date: group.date,
    model: group.model,
    promptId: group.promptId,
    topicId: group.topicId,
    citedUrl: group.citedUrl,
    citedDomain: group.citedDomain,
    citationCount: group.citationCount,
    visibilityScore: group.visibilityValues.length > 0
      ? round(group.visibilityValues.reduce((sum, value) => sum + value, 0) / group.visibilityValues.length, 2)
      : null,
  }));
}

function computeVisibilityScore(visibilityScore: number | null, citationCount: number) {
  if (typeof visibilityScore === 'number' && Number.isFinite(visibilityScore)) {
    return clamp(round(visibilityScore, 2), 0, 100);
  }

  return clamp(citationCount * 20, 0, 100);
}

/**
 * Assisted impact is intentionally probabilistic: it uses only the traffic lift
 * that remains after removing directly observed AI sessions, then weights that
 * lift by citation intensity and Quorum visibility.
 */
export function computeAssistedSessionsEstimate(input: {
  totalSessions: number;
  baselineSessions: number;
  observedAiSessions: number;
  visibilityScore: number;
  citationCount: number;
}) {
  const postCitationLift = Math.max(
    input.totalSessions - input.baselineSessions - input.observedAiSessions,
    0,
  );
  const visibilityWeight = clamp(input.visibilityScore / 100, 0, 1);
  const citationWeight = clamp(input.citationCount / 3, 0, 1);

  return round(
    postCitationLift * (0.35 + 0.65 * visibilityWeight) * (0.4 + 0.6 * citationWeight),
  );
}

export function computeAttributionConfidence(input: {
  observedAiSessions: number;
  totalSessions: number;
  baselineSessions: number;
  citationCount: number;
  assistedSessionsEstimate: number;
}): AttributionConfidence {
  if (
    input.observedAiSessions > 0 &&
    input.baselineSessions > 0 &&
    input.citationCount >= 2
  ) {
    return 'high';
  }

  if (
    input.totalSessions > 0 &&
    (input.observedAiSessions > 0 || input.assistedSessionsEstimate > 0)
  ) {
    return 'medium';
  }

  return 'low';
}

function aggregateTraffic(rows: DailyPageMetric[]) {
  return rows.reduce(
    (acc, row) => {
      acc.sessions += row.sessions;
      acc.conversions += row.conversions;
      acc.revenue += row.revenue;

      const sourceResult = classifyTrafficSource({ source: row.source, medium: row.medium });
      if (sourceResult.classification === 'ai_observed') {
        acc.observedAiSessions += row.sessions;
      }

      return acc;
    },
    { sessions: 0, conversions: 0, revenue: 0, observedAiSessions: 0 },
  );
}

function buildTrafficIndexes(trafficMetrics: DailyPageMetric[], siteUrl?: string | null) {
  const rowsByExactUrl = new Map<string, DailyPageMetric[]>();
  const rowsByPath = new Map<string, DailyPageMetric[]>();
  const pageDailyTotals = new Map<string, Map<string, number>>();

  for (const row of trafficMetrics) {
    const exactUrl = canonicalizePageUrl(row.pageUrl, siteUrl);
    const pathKey = getPagePathKey(row.pageUrl, siteUrl);
    const exactRowKey = exactUrl ? `${row.date}::${exactUrl}` : null;
    const pathRowKey = pathKey ? `${row.date}::${pathKey}` : null;

    if (exactRowKey) {
      const list = rowsByExactUrl.get(exactRowKey) || [];
      list.push(row);
      rowsByExactUrl.set(exactRowKey, list);
    }

    if (pathRowKey) {
      const list = rowsByPath.get(pathRowKey) || [];
      list.push(row);
      rowsByPath.set(pathRowKey, list);
    }

    const pageIdentity = exactUrl || pathKey;
    if (!pageIdentity) continue;

    const dayTotals = pageDailyTotals.get(pageIdentity) || new Map<string, number>();
    dayTotals.set(row.date, (dayTotals.get(row.date) || 0) + row.sessions);
    pageDailyTotals.set(pageIdentity, dayTotals);
  }

  return {
    rowsByExactUrl,
    rowsByPath,
    pageDailyTotals,
  };
}

function computeBaselineSessions(pageDailyTotals: Map<string, number> | undefined, targetDate: string) {
  if (!pageDailyTotals || pageDailyTotals.size === 0) return 0;

  const history = Array.from(pageDailyTotals.entries())
    .filter(([date]) => date < targetDate)
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 7);

  if (history.length === 0) return 0;

  return round(
    history.reduce((sum, [, sessions]) => sum + sessions, 0) / history.length,
  );
}

export function buildAttributionEvents(args: {
  citations: AttributionInputCitation[];
  trafficMetrics: DailyPageMetric[];
  siteUrl?: string | null;
}) {
  const indexes = buildTrafficIndexes(args.trafficMetrics, args.siteUrl);

  return args.citations.map<AttributionComputationRow>((citation) => {
    const canonicalCitedUrl = canonicalizePageUrl(citation.citedUrl, args.siteUrl) || citation.citedUrl;
    const pathKey = getPagePathKey(citation.citedUrl, args.siteUrl);
    const exactMatch = indexes.rowsByExactUrl.get(`${citation.date}::${canonicalCitedUrl}`) || [];
    const pathMatch = pathKey ? indexes.rowsByPath.get(`${citation.date}::${pathKey}`) || [] : [];
    const matchedRows = exactMatch.length > 0 ? exactMatch : pathMatch;
    const pageIdentity = indexes.pageDailyTotals.has(canonicalCitedUrl)
      ? canonicalCitedUrl
      : (pathKey && indexes.pageDailyTotals.has(pathKey) ? pathKey : canonicalCitedUrl || pathKey);
    const aggregatedTraffic = aggregateTraffic(matchedRows);
    const baselineSessions = computeBaselineSessions(
      pageIdentity ? indexes.pageDailyTotals.get(pageIdentity) : undefined,
      citation.date,
    );

    const visibilityScore = computeVisibilityScore(citation.visibilityScore, citation.citationCount);
    const observedShare = aggregatedTraffic.sessions > 0
      ? aggregatedTraffic.observedAiSessions / aggregatedTraffic.sessions
      : 0;
    const conversionsObserved = round(aggregatedTraffic.conversions * observedShare);
    const revenueObserved = round(aggregatedTraffic.revenue * observedShare);
    const assistedSessionsEstimate = computeAssistedSessionsEstimate({
      totalSessions: aggregatedTraffic.sessions,
      baselineSessions,
      observedAiSessions: aggregatedTraffic.observedAiSessions,
      visibilityScore,
      citationCount: citation.citationCount,
    });

    const attributionConfidence = computeAttributionConfidence({
      observedAiSessions: aggregatedTraffic.observedAiSessions,
      totalSessions: aggregatedTraffic.sessions,
      baselineSessions,
      citationCount: citation.citationCount,
      assistedSessionsEstimate,
    });

    return {
      date: citation.date,
      model: citation.model,
      promptId: citation.promptId,
      topicId: citation.topicId,
      citedUrl: canonicalCitedUrl,
      citedDomain: citation.citedDomain || getCitedDomain(canonicalCitedUrl),
      citationCount: citation.citationCount,
      visibilityScore,
      observedAiSessions: aggregatedTraffic.observedAiSessions,
      assistedSessionsEstimate,
      conversionsObserved,
      revenueObserved,
      attributionConfidence,
    };
  });
}

export const ATTRIBUTION_ENGINE_VERSION = 'v1';
export const ATTRIBUTION_SOURCE_DETECTION_VERSION = AI_TRAFFIC_DETECTION_VERSION;
