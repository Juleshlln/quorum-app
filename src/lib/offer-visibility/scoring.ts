import type { OfferCompetitorScore, OfferMention, OfferPrompt, OfferPromptRun, OfferScore } from '@/lib/offer-visibility/types';

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getPositionScore(averagePosition: number | null) {
  if (averagePosition === null || !Number.isFinite(averagePosition)) return 0;
  if (averagePosition <= 1) return 1;
  if (averagePosition <= 2) return 0.8;
  if (averagePosition <= 3) return 0.6;
  if (averagePosition <= 5) return 0.4;
  return 0.2;
}

export function calculateVisibilityScore(args: {
  appearanceRate: number | null;
  recommendationRate: number | null;
  averagePosition: number | null;
}) {
  const appearance = args.appearanceRate ?? 0;
  const recommendation = args.recommendationRate ?? 0;
  const positionScore = getPositionScore(args.averagePosition);
  return round(clamp(appearance * 45 + recommendation * 35 + positionScore * 20, 0, 100), 1);
}

export function computeOfferScore(args: {
  prompts: OfferPrompt[];
  runs: OfferPromptRun[];
  mentions: OfferMention[];
}): OfferScore {
  const successfulRuns = args.runs.filter((run) => run.status === 'success');
  const mentionsByRun = new Map<string, OfferMention[]>();
  for (const mention of args.mentions) {
    const list = mentionsByRun.get(mention.offer_prompt_run_id) || [];
    list.push(mention);
    mentionsByRun.set(mention.offer_prompt_run_id, list);
  }

  const ownBrandMentionedRuns = successfulRuns.filter((run) =>
    (mentionsByRun.get(run.id) || []).some((mention) => mention.entity_type === 'own_brand')
  );
  const ownBrandRecommendedRuns = successfulRuns.filter((run) =>
    (mentionsByRun.get(run.id) || []).some((mention) => mention.entity_type === 'own_brand' && mention.is_recommended)
  );

  const ownBrandMentions = args.mentions.filter((mention) => mention.entity_type === 'own_brand');
  const competitorMentions = args.mentions.filter((mention) => mention.entity_type === 'competitor');
  const brandAndCompetitorMentions = args.mentions.filter((mention) =>
    mention.entity_type === 'own_brand' || mention.entity_type === 'competitor'
  );
  const positions = ownBrandMentions
    .map((mention) => mention.position)
    .filter((position): position is number => typeof position === 'number' && Number.isFinite(position));

  const appearanceRate = successfulRuns.length > 0 ? ownBrandMentionedRuns.length / successfulRuns.length : null;
  const recommendationRate = successfulRuns.length > 0 ? ownBrandRecommendedRuns.length / successfulRuns.length : null;
  const averagePosition = positions.length > 0 ? round(positions.reduce((sum, item) => sum + item, 0) / positions.length, 1) : null;
  const categoryShareOfVoice = brandAndCompetitorMentions.length > 0
    ? ownBrandMentions.length / brandAndCompetitorMentions.length
    : null;

  return {
    prompts_tracked: args.prompts.filter((prompt) => prompt.is_active).length,
    total_runs: args.runs.length,
    successful_runs: successfulRuns.length,
    own_brand_mentioned_runs: ownBrandMentionedRuns.length,
    own_brand_recommended_runs: ownBrandRecommendedRuns.length,
    own_brand_mentions: ownBrandMentions.length,
    competitor_mentions: competitorMentions.length,
    appearance_rate: appearanceRate === null ? null : round(appearanceRate, 4),
    recommendation_rate: recommendationRate === null ? null : round(recommendationRate, 4),
    average_position: averagePosition,
    category_share_of_voice: categoryShareOfVoice === null ? null : round(categoryShareOfVoice, 4),
    position_score: getPositionScore(averagePosition),
    visibility_score: successfulRuns.length > 0
      ? calculateVisibilityScore({ appearanceRate, recommendationRate, averagePosition })
      : null,
    top_competitors: computeCompetitorScores({ runs: successfulRuns, mentions: competitorMentions }),
    last_run_at: args.runs[0]?.created_at ?? null,
    evolution_status: 'insufficient_data',
  };
}

export function computeCompetitorScores(args: {
  runs: OfferPromptRun[];
  mentions: OfferMention[];
}): OfferCompetitorScore[] {
  const runById = new Map(args.runs.map((run) => [run.id, run]));
  const byName = new Map<string, OfferCompetitorScore>();

  for (const mention of args.mentions) {
    if (mention.entity_type !== 'competitor') continue;
    const key = mention.entity_name.trim().toLowerCase();
    if (!key) continue;
    const current = byName.get(key) || {
      name: mention.entity_name,
      mentions: 0,
      recommended_mentions: 0,
      recommendation_rate: null,
      average_position: null,
      prompts: [],
    };

    current.mentions += 1;
    if (mention.is_recommended) current.recommended_mentions += 1;

    const run = runById.get(mention.offer_prompt_run_id);
    if (run && !current.prompts.some((prompt) => prompt.id === run.offer_prompt_id)) {
      current.prompts.push({ id: run.offer_prompt_id, prompt: run.prompt });
    }

    const prevAverage = current.average_position;
    if (typeof mention.position === 'number') {
      const previousCount = current.mentions - 1;
      current.average_position = prevAverage === null
        ? mention.position
        : round(((prevAverage * previousCount) + mention.position) / current.mentions, 1);
    }

    byName.set(key, current);
  }

  return Array.from(byName.values())
    .map((competitor) => ({
      ...competitor,
      recommendation_rate: competitor.mentions > 0 ? round(competitor.recommended_mentions / competitor.mentions, 4) : null,
      prompts: competitor.prompts,
    }))
    .sort((left, right) => right.mentions - left.mentions || left.name.localeCompare(right.name))
    .slice(0, 10);
}
