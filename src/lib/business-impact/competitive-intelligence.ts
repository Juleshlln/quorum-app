import type {
  CompetitiveBrandShare,
  CompetitiveIntelligenceOverview,
  CompetitiveSourceGap,
  CompetitiveSourceOverlap,
  OpportunityGapCard,
  PromptCompetitiveMapRow,
} from '@/lib/business-impact/types';
import { round, toPercent } from '@/lib/business-impact/math';

type CompetitiveRun = {
  id: string;
  date: string;
  promptId: string;
  promptText: string;
  topicId: string | null;
  topicName: string | null;
  brandMentioned: boolean;
  competitorsMentioned: string[];
};

type CompetitiveCitation = {
  promptRunId: string;
  date: string;
  domain: string | null;
  category: string | null;
  isOwned: boolean;
  competitorId: string | null;
  url: string | null;
};

type CompetitorRecord = {
  id: string;
  name: string;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function buildPriority(value: number): 'high' | 'medium' | 'low' {
  if (value >= 20) return 'high';
  if (value >= 8) return 'medium';
  return 'low';
}

/**
 * Share of answer = percentage of monitored answers where a brand appears.
 * It does not claim click-through or conversion ownership; it only measures
 * answer-level presence.
 */
export function computeShareOfAnswer(args: {
  brandName: string;
  runs: CompetitiveRun[];
  competitors: CompetitorRecord[];
}): CompetitiveBrandShare[] {
  const totalRuns = args.runs.length;
  const registry = new Map<string, string>();

  for (const competitor of args.competitors) {
    registry.set(normalizeName(competitor.name), competitor.name);
  }
  for (const run of args.runs) {
    for (const competitorName of run.competitorsMentioned) {
      const normalized = normalizeName(competitorName);
      if (!registry.has(normalized)) {
        registry.set(normalized, competitorName);
      }
    }
  }

  const results: CompetitiveBrandShare[] = [
    {
      brand: args.brandName,
      mentions: args.runs.filter((run) => run.brandMentioned).length,
      share: toPercent(args.runs.filter((run) => run.brandMentioned).length, totalRuns),
    },
  ];

  for (const [normalizedName, displayName] of registry.entries()) {
    const mentions = args.runs.filter((run) =>
      run.competitorsMentioned.some((name) => normalizeName(name) === normalizedName),
    ).length;
    results.push({
      brand: displayName,
      mentions,
      share: toPercent(mentions, totalRuns),
    });
  }

  return results.sort((left, right) => right.share - left.share);
}

/**
 * Share of clickable surface = distribution of citations between owned brand
 * URLs, competitor-owned URLs and third-party URLs.
 */
export function computeShareOfClickableSurface(citations: CompetitiveCitation[]) {
  const total = citations.length;
  const brand = citations.filter((citation) => citation.isOwned).length;
  const competitors = citations.filter(
    (citation) => !citation.isOwned && citation.category === 'competitor',
  ).length;
  const thirdParty = Math.max(total - brand - competitors, 0);

  return {
    brand: toPercent(brand, total),
    competitors: toPercent(competitors, total),
    thirdParty: toPercent(thirdParty, total),
  };
}

/**
 * Source ownership gap highlights third-party domains where competitors are
 * cited materially more often than the brand.
 */
export function computeSourceOwnershipGap(args: {
  runsById: Map<string, CompetitiveRun>;
  citations: CompetitiveCitation[];
}): CompetitiveSourceGap[] {
  const byDomain = new Map<string, { brandCitations: number; competitorCitations: number }>();

  for (const citation of args.citations) {
    if (!citation.domain || citation.isOwned) continue;
    const run = args.runsById.get(citation.promptRunId);
    if (!run) continue;

    const current = byDomain.get(citation.domain) || {
      brandCitations: 0,
      competitorCitations: 0,
    };

    if (run.brandMentioned) current.brandCitations += 1;
    if (run.competitorsMentioned.length > 0) current.competitorCitations += 1;
    byDomain.set(citation.domain, current);
  }

  return Array.from(byDomain.entries())
    .map<CompetitiveSourceGap>(([domain, counts]) => {
      const gap = counts.competitorCitations - counts.brandCitations;
      return {
        domain,
        brandCitations: counts.brandCitations,
        competitorCitations: counts.competitorCitations,
        gap,
        priority: buildPriority(gap * 5),
      };
    })
    .filter((row) => row.gap > 0)
    .sort((left, right) => right.gap - left.gap)
    .slice(0, 12);
}

function computeJaccardOverlap(left: Set<string>, right: Set<string>) {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  const intersection = [...left].filter((value) => right.has(value)).length;
  return round((intersection / union.size) * 100, 1);
}

export function computeCompetitorSourceOverlap(args: {
  competitors: CompetitorRecord[];
  runs: CompetitiveRun[];
  citations: CompetitiveCitation[];
}): CompetitiveSourceOverlap[] {
  const citationsByRun = new Map<string, CompetitiveCitation[]>();
  for (const citation of args.citations) {
    const list = citationsByRun.get(citation.promptRunId) || [];
    list.push(citation);
    citationsByRun.set(citation.promptRunId, list);
  }

  const brandDomains = new Set<string>();
  for (const run of args.runs) {
    if (!run.brandMentioned) continue;
    for (const citation of citationsByRun.get(run.id) || []) {
      if (!citation.domain || citation.isOwned) continue;
      brandDomains.add(citation.domain);
    }
  }

  return args.competitors.map((competitor) => {
    const competitorDomains = new Set<string>();

    for (const run of args.runs) {
      const isCompetitorPresent = run.competitorsMentioned.some(
        (name) => normalizeName(name) === normalizeName(competitor.name),
      );
      if (!isCompetitorPresent) continue;

      for (const citation of citationsByRun.get(run.id) || []) {
        if (!citation.domain || citation.isOwned) continue;
        competitorDomains.add(citation.domain);
      }
    }

    const sharedDomains = [...brandDomains].filter((domain) => competitorDomains.has(domain)).length;
    return {
      competitor: competitor.name,
      overlap: computeJaccardOverlap(brandDomains, competitorDomains),
      sharedDomains,
      competitorOnlyDomains: [...competitorDomains].filter((domain) => !brandDomains.has(domain)).length,
      brandOnlyDomains: [...brandDomains].filter((domain) => !competitorDomains.has(domain)).length,
    };
  }).sort((left, right) => right.overlap - left.overlap);
}

/**
 * Prompt-level competitive map identifies prompts where the brand under-indexes
 * versus the strongest competitor and where owned citations are scarce.
 */
export function computePromptLevelCompetitiveMap(args: {
  runs: CompetitiveRun[];
  citations: CompetitiveCitation[];
  competitors: CompetitorRecord[];
}): PromptCompetitiveMapRow[] {
  const citationsByRun = new Map<string, CompetitiveCitation[]>();
  const promptGroups = new Map<string, CompetitiveRun[]>();

  for (const citation of args.citations) {
    const list = citationsByRun.get(citation.promptRunId) || [];
    list.push(citation);
    citationsByRun.set(citation.promptRunId, list);
  }

  for (const run of args.runs) {
    const list = promptGroups.get(run.promptId) || [];
    list.push(run);
    promptGroups.set(run.promptId, list);
  }

  return Array.from(promptGroups.entries())
    .map<PromptCompetitiveMapRow>(([promptId, runs]) => {
      const totalRuns = runs.length;
      const brandMentions = runs.filter((run) => run.brandMentioned).length;
      const brandShare = toPercent(brandMentions, totalRuns);
      const competitorPresence = toPercent(
        runs.filter((run) => run.competitorsMentioned.length > 0).length,
        totalRuns,
      );

      const competitorCounts = new Map<string, number>();
      for (const run of runs) {
        for (const competitorName of run.competitorsMentioned) {
          const normalized = normalizeName(competitorName);
          competitorCounts.set(normalized, (competitorCounts.get(normalized) || 0) + 1);
        }
      }

      const topCompetitorEntry = Array.from(competitorCounts.entries())
        .sort((left, right) => right[1] - left[1])[0];
      const topCompetitor = topCompetitorEntry
        ? args.competitors.find((competitor) => normalizeName(competitor.name) === topCompetitorEntry[0])?.name || topCompetitorEntry[0]
        : null;
      const topCompetitorShare = topCompetitorEntry
        ? toPercent(topCompetitorEntry[1], totalRuns)
        : 0;

      const promptCitations = runs.flatMap((run) => citationsByRun.get(run.id) || []);
      const ownedClickableShare = toPercent(
        promptCitations.filter((citation) => citation.isOwned).length,
        promptCitations.length,
      );

      const brandDomains = new Set<string>();
      const competitorDomains = new Set<string>();
      for (const run of runs) {
        for (const citation of citationsByRun.get(run.id) || []) {
          if (!citation.domain || citation.isOwned) continue;
          if (run.brandMentioned) brandDomains.add(citation.domain);
          if (run.competitorsMentioned.length > 0) competitorDomains.add(citation.domain);
        }
      }

      const competitiveGap = Math.max(topCompetitorShare - brandShare, 0);
      return {
        promptId,
        promptText: runs[0]?.promptText || 'Untitled prompt',
        topicId: runs[0]?.topicId || null,
        topicName: runs[0]?.topicName || null,
        totalRuns,
        brandShare,
        competitorPresence,
        topCompetitor,
        topCompetitorShare,
        ownedClickableShare,
        sourceOverlap: computeJaccardOverlap(brandDomains, competitorDomains),
        priority: buildPriority(competitiveGap + Math.max(50 - ownedClickableShare, 0)),
      };
    })
    .sort((left, right) => {
      const leftGap = left.topCompetitorShare - left.brandShare;
      const rightGap = right.topCompetitorShare - right.brandShare;
      return rightGap - leftGap;
    });
}

/**
 * Visibility volatility index = mean absolute day-over-day change in the
 * brand's share of answer.
 */
export function computeVisibilityVolatilityIndex(runs: CompetitiveRun[]) {
  const byDay = new Map<string, { total: number; brand: number }>();

  for (const run of runs) {
    const current = byDay.get(run.date) || { total: 0, brand: 0 };
    current.total += 1;
    if (run.brandMentioned) current.brand += 1;
    byDay.set(run.date, current);
  }

  const series = Array.from(byDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => toPercent(value.brand, value.total));

  if (series.length < 2) return 0;

  let totalChange = 0;
  for (let index = 1; index < series.length; index += 1) {
    totalChange += Math.abs(series[index] - series[index - 1]);
  }

  return round(totalChange / (series.length - 1), 1);
}

export function computeOpportunityGapSummary(args: {
  promptMap: PromptCompetitiveMapRow[];
  sourceGaps: CompetitiveSourceGap[];
}): OpportunityGapCard[] {
  const opportunities: OpportunityGapCard[] = [];

  for (const prompt of args.promptMap.slice(0, 6)) {
    const gap = Math.max(prompt.topCompetitorShare - prompt.brandShare, 0);
    if (gap <= 0) continue;

    opportunities.push({
      id: `prompt:${prompt.promptId}`,
      title: prompt.promptText,
      summary: prompt.topCompetitor
        ? `${prompt.topCompetitor} surpasse la marque sur ce prompt tandis que la surface cliquable possédée reste limitée.`
        : 'La visibilité concurrentielle dépasse celle de la marque sur ce prompt.',
      priority: prompt.priority,
      metric: 'prompt_gap',
      value: gap,
    });
  }

  for (const gap of args.sourceGaps.slice(0, 4)) {
    opportunities.push({
      id: `source:${gap.domain}`,
      title: gap.domain,
      summary: 'Les concurrents sont cités plus souvent que la marque sur ce domaine source.',
      priority: gap.priority,
      metric: 'source_gap',
      value: gap.gap,
    });
  }

  return opportunities
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

export function buildCompetitiveIntelligence(args: {
  brandName: string;
  runs: CompetitiveRun[];
  citations: CompetitiveCitation[];
  competitors: CompetitorRecord[];
}): CompetitiveIntelligenceOverview {
  const runsById = new Map(args.runs.map((run) => [run.id, run]));
  const shareOfAnswer = computeShareOfAnswer(args);
  const shareOfClickableSurface = computeShareOfClickableSurface(args.citations);
  const sourceOwnershipGap = computeSourceOwnershipGap({
    runsById,
    citations: args.citations,
  });
  const competitorSourceOverlap = computeCompetitorSourceOverlap(args);
  const promptLevelCompetitiveMap = computePromptLevelCompetitiveMap(args);
  const visibilityVolatilityIndex = computeVisibilityVolatilityIndex(args.runs);
  const opportunityGapSummary = computeOpportunityGapSummary({
    promptMap: promptLevelCompetitiveMap,
    sourceGaps: sourceOwnershipGap,
  });

  return {
    shareOfAnswer,
    shareOfClickableSurface,
    sourceOwnershipGap,
    competitorSourceOverlap,
    promptLevelCompetitiveMap,
    visibilityVolatilityIndex,
    opportunityGapSummary,
  };
}
