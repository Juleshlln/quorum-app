import {
  buildPreviousWindow,
  buildWindowFromDays,
  type ProductVisibilityDateWindow,
} from '@/lib/product-visibility/service';
import { parseRange, rangeToDays, type ProductVisibilityRange } from '@/lib/product-visibility/format';
import { runOfferAnalysis } from '@/lib/offer-visibility/service';

export type OverviewProviderId = 'all' | 'openai' | 'gemini' | 'claude' | 'perplexity' | 'llama' | 'grok' | 'deepseek';
export type OverviewProviderStatus = 'configured' | 'missing_api_key' | 'disabled' | 'error';
export type OverviewOpportunityLevel = 'high' | 'medium' | 'low';
export type OverviewPriority = 'high' | 'medium' | 'low';
export type OverviewKpiDetailKey =
  | 'trackedOffers'
  | 'visibleOffers'
  | 'ownedMentions'
  | 'competitorMentions'
  | 'averagePosition'
  | 'priorityOpportunities';

export type OverviewKpiDetail = {
  title: string;
  explanation: string;
  formula: string;
  source: string;
  href: string;
  ctaLabel: string;
  rows: Array<{
    label: string;
    value: string;
    description: string;
    href?: string;
  }>;
  emptyMessage: string;
};

export type CompetitiveAIPositionData = {
  availableModels: Array<{
    id: Exclude<OverviewProviderId, 'all'>;
    label: string;
  }>;
  products: Array<{
    productOrServiceId: string;
    productOrServiceName: string;
    type: 'product_category' | 'service' | string;
    totalRuns: number;
    availableModels: Array<{
      id: Exclude<OverviewProviderId, 'all'>;
      label: string;
    }>;
    competitors: Array<{
      name: string;
      type: 'owned' | 'competitor' | 'third_party';
      models: Array<{
        model: Exclude<OverviewProviderId, 'all'>;
        label: string;
        averagePosition: number | null;
        appearanceRate: number;
        mentionsCount: number;
        totalRuns: number;
        trend: Array<{
          date: string;
          visibilityRate: number | null;
          mentionsCount: number;
          totalRuns: number;
        }>;
      }>;
    }>;
  }>;
};

export type OverviewResponse = {
  period: {
    range: ProductVisibilityRange;
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
  selectedProvider: OverviewProviderId;
  kpis: {
    globalVisibilityScore: number | null;
    productVisibilityScore: number | null;
    serviceVisibilityScore: number | null;
    trackedOffers: number;
    trackedProducts: number;
    trackedServices: number;
    visibleOffers: number | null;
    visibleProducts: number | null;
    visibleServices: number | null;
    ownedMentions: number | null;
    competitorMentions: number | null;
    averagePosition: number | null;
    priorityOpportunities: number | null;
  };
  deltas: {
    globalVisibilityScore: number | null;
    productVisibilityScore: number | null;
    serviceVisibilityScore: number | null;
    visibleOffers: number | null;
    ownedMentions: number | null;
    competitorMentions: number | null;
    averagePosition: number | null;
    priorityOpportunities: number | null;
  };
  providers: Array<{
    id: Exclude<OverviewProviderId, 'all'>;
    label: string;
    status: OverviewProviderStatus;
    hasData: boolean;
    visibilityScore: number | null;
    visibleOffers: number | null;
    ownedMentions: number | null;
    competitorMentions: number | null;
    averagePosition: number | null;
    lastRunAt: string | null;
  }>;
  priorityOffers: Array<{
    id: string;
    name: string;
    category: string | null;
    visibilityScore: number | null;
    competitorMentions: number;
    topCompetitor: string | null;
    aiProvider: string | null;
    opportunityLevel: OverviewOpportunityLevel;
    recommendedAction: string;
  }>;
  topVisibleOffers: Array<{
    id: string;
    name: string;
    type: string;
    visibilityScore: number | null;
    ownedMentions: number;
    competitorMentions: number;
    aiProvider: string | null;
    lastRunAt: string | null;
  }>;
  invisibleOffers: Array<{
    id: string;
    name: string;
    type: string;
    visibilityScore: number | null;
    competitorMentions: number;
    topCompetitor: string | null;
    aiProvider: string | null;
    reason: string;
  }>;
  topCompetitors: Array<{
    name: string;
    categories: string[];
    mentions: number;
    dominantProvider: string | null;
    gapVsOwned: number | null;
    sources: string[];
  }>;
  importantQuestions: Array<{
    id: string;
    question: string;
    category: string | null;
    buyingIntent: string | null;
    aiProvider: string | null;
    ownedOffersMentioned: number;
    competitorsMentioned: number;
    score: number | null;
    lastRunAt: string | null;
  }>;
  insights: Array<{
    title: string;
    description: string;
    evidence: string;
    priority: OverviewPriority;
    recommendedAction: string;
  }>;
  sampleResponse: {
    aiProvider: string;
    question: string;
    date: string;
    excerpt: string;
    detectedOwnedOffers: string[];
    detectedCompetitors: string[];
    detectedBrands: string[];
    responseId: string | null;
  } | null;
  competitivePosition: CompetitiveAIPositionData;
  state: {
    hasTrackedOffers: boolean;
    hasQueries: boolean;
    hasRuns: boolean;
    hasResults: boolean;
    message: string;
    nextAction: {
      label: string;
      href?: string;
      action?: string;
    } | null;
  };
  kpiDetails: Record<OverviewKpiDetailKey, OverviewKpiDetail>;
};

type OfferRow = {
  id: string;
  name: string;
  type: string;
  business_priority: string | null;
  is_active: boolean;
};

type IntentRow = {
  id: string;
  offer_category_id: string;
  label: string;
  intent_type: string;
  is_active: boolean;
};

type PromptRow = {
  id: string;
  offer_category_id: string;
  offer_intent_id: string | null;
  prompt: string;
  ai_provider: string | null;
  is_active: boolean;
};

type RunRow = {
  id: string;
  offer_prompt_id: string;
  offer_category_id: string;
  ai_provider: string | null;
  prompt: string;
  answer: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

type MentionRow = {
  id: string;
  offer_prompt_run_id: string;
  offer_category_id: string;
  entity_name: string;
  entity_type: string;
  matched_domain: string | null;
  position: number | null;
  is_recommended: boolean;
};

const PROVIDERS: Array<{ id: Exclude<OverviewProviderId, 'all'>; label: string; env: string[] }> = [
  { id: 'openai', label: 'ChatGPT', env: ['OPENAI_API_KEY'] },
  { id: 'gemini', label: 'Gemini', env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
  { id: 'claude', label: 'Claude', env: ['ANTHROPIC_API_KEY'] },
  { id: 'perplexity', label: 'Perplexity', env: ['PERPLEXITY_API_KEY'] },
  { id: 'llama', label: 'Llama', env: ['LLAMA_API_KEY', 'META_API_KEY'] },
  { id: 'grok', label: 'Grok', env: ['GROK_API_KEY', 'XAI_API_KEY'] },
  { id: 'deepseek', label: 'DeepSeek', env: ['DEEPSEEK_API_KEY'] },
];

const PROVIDER_ALIASES: Record<string, Exclude<OverviewProviderId, 'all'>> = {
  openai: 'openai',
  chatgpt: 'openai',
  gpt: 'openai',
  google: 'gemini',
  gemini: 'gemini',
  anthropic: 'claude',
  claude: 'claude',
  perplexity: 'perplexity',
  llama: 'llama',
  meta: 'llama',
  grok: 'grok',
  xai: 'grok',
  deepseek: 'deepseek',
};

function round(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeProviderId(value: string | null | undefined): Exclude<OverviewProviderId, 'all'> | null {
  if (!value) return null;
  const key = value.toLowerCase().trim().replace(/\s+/g, '');
  return PROVIDER_ALIASES[key] || null;
}

export function parseOverviewProvider(value: string | null | undefined): OverviewProviderId {
  if (!value || value === 'all') return 'all';
  return PROVIDERS.some((provider) => provider.id === value) ? (value as OverviewProviderId) : 'all';
}

function providerHasKey(provider: (typeof PROVIDERS)[number]) {
  return provider.env.some((name) => Boolean(process.env[name]));
}

function getPositionBonus(averagePosition: number | null) {
  if (averagePosition === null || !Number.isFinite(averagePosition)) return 0;
  return clamp((10 - Math.min(averagePosition, 10)) / 9, 0, 1);
}

function computeProductVisibilityScore(args: {
  ownedMentions: number;
  competitorMentions: number;
  averagePosition: number | null;
  visibleProviderCount: number;
  providerDataCount: number;
}) {
  const totalMentions = args.ownedMentions + args.competitorMentions;
  if (totalMentions <= 0 || args.providerDataCount <= 0) return null;

  const ownedShare = args.ownedMentions / totalMentions;
  const coverage = args.providerDataCount > 0 ? args.visibleProviderCount / args.providerDataCount : 0;

  return round(
    clamp(
      ownedShare * 70 + getPositionBonus(args.averagePosition) * 20 + coverage * 10,
      0,
      100,
    ),
    1,
  );
}

function diffOrNull(current: number | null | undefined, previous: number | null | undefined, digits = 1) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return round(current - previous, digits);
}

function isInProvider(run: RunRow, selectedProvider: OverviewProviderId) {
  if (selectedProvider === 'all') return true;
  return normalizeProviderId(run.ai_provider) === selectedProvider;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
}

function distinctStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (trimmed) seen.add(trimmed);
  }
  return Array.from(seen);
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function scoreStatus(score: number | null): 'excellent' | 'solid' | 'watch' | 'weak' | 'insufficient' {
  if (score === null) return 'insufficient';
  if (score >= 75) return 'excellent';
  if (score >= 60) return 'solid';
  if (score >= 40) return 'watch';
  if (score >= 1) return 'weak';
  return 'insufficient';
}

function opportunityLevel(score: number): OverviewOpportunityLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function scoreFromMentions(ownedMentions: number, competitorMentions: number, averagePosition: number | null) {
  return computeProductVisibilityScore({
    ownedMentions,
    competitorMentions,
    averagePosition,
    visibleProviderCount: ownedMentions > 0 ? 1 : 0,
    providerDataCount: 1,
  });
}

function aggregateMetrics(args: {
  offers: OfferRow[];
  runs: RunRow[];
  mentions: MentionRow[];
  selectedProvider: OverviewProviderId;
  configuredProviderIds: Set<Exclude<OverviewProviderId, 'all'>>;
}) {
  const activeOfferIds = new Set(args.offers.filter((offer) => offer.is_active).map((offer) => offer.id));
  const successfulRuns = args.runs.filter(
    (run) => {
      const provider = normalizeProviderId(run.ai_provider);
      return (
        run.status === 'success'
        && activeOfferIds.has(run.offer_category_id)
        && provider !== null
        && args.configuredProviderIds.has(provider)
        && isInProvider(run, args.selectedProvider)
      );
    },
  );
  const successfulRunIds = new Set(successfulRuns.map((run) => run.id));
  const relevantMentions = args.mentions.filter((mention) => successfulRunIds.has(mention.offer_prompt_run_id));
  const ownedMentions = relevantMentions.filter((mention) => mention.entity_type === 'own_brand');
  const competitorMentions = relevantMentions.filter((mention) => mention.entity_type === 'competitor');
  const positions = ownedMentions
    .map((mention) => mention.position)
    .filter((position): position is number => typeof position === 'number' && Number.isFinite(position) && position > 0);
  const visibleOfferIds = new Set(ownedMentions.map((mention) => mention.offer_category_id));

  const providerData = new Map<Exclude<OverviewProviderId, 'all'>, { hasData: boolean; visible: boolean }>();
  for (const provider of PROVIDERS) {
    const providerRuns = successfulRuns.filter((run) => normalizeProviderId(run.ai_provider) === provider.id);
    const providerRunIds = new Set(providerRuns.map((run) => run.id));
    const providerOwnedMentions = ownedMentions.filter((mention) => providerRunIds.has(mention.offer_prompt_run_id));
    providerData.set(provider.id, {
      hasData: providerRuns.length > 0,
      visible: providerOwnedMentions.length > 0,
    });
  }
  const providersWithData = Array.from(providerData.values()).filter((provider) => provider.hasData).length;
  const providersWithVisibility = Array.from(providerData.values()).filter((provider) => provider.hasData && provider.visible).length;
  const averagePosition = average(positions);

  return {
    successfulRuns,
    relevantMentions,
    ownedMentions,
    competitorMentions,
    averagePosition,
    visibleOfferIds,
    productVisibilityScore: computeProductVisibilityScore({
      ownedMentions: ownedMentions.length,
      competitorMentions: competitorMentions.length,
      averagePosition,
      visibleProviderCount: providersWithVisibility,
      providerDataCount: providersWithData,
    }),
  };
}

function providerOption(providerId: Exclude<OverviewProviderId, 'all'>) {
  const provider = PROVIDERS.find((item) => item.id === providerId);
  return {
    id: providerId,
    label: provider?.label || providerId,
  };
}

function mentionActorType(entityType: string): 'owned' | 'competitor' | 'third_party' | null {
  if (entityType === 'own_brand') return 'owned';
  if (entityType === 'competitor') return 'competitor';
  if (entityType === 'third_party') return 'third_party';
  return null;
}

function normalizeEntityKey(name: string, type: 'owned' | 'competitor' | 'third_party') {
  return `${type}:${name.toLowerCase().trim().replace(/\s+/g, ' ')}`;
}

function toDateKey(value: string | null | undefined) {
  return String(value || '').slice(0, 10);
}

function buildDateKeys(window: ProductVisibilityDateWindow) {
  const dates: string[] = [];
  const cursor = new Date(`${window.startDate}T00:00:00.000Z`);
  const end = new Date(`${window.endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function buildCompetitiveAIPosition(args: {
  offers: OfferRow[];
  runs: RunRow[];
  mentions: MentionRow[];
  window: ProductVisibilityDateWindow;
  projectName?: string | null;
}): CompetitiveAIPositionData {
  const activeOffers = args.offers.filter((offer) => offer.is_active);
  const activeOfferIds = new Set(activeOffers.map((offer) => offer.id));
  const successfulRuns = args.runs.filter((run) => {
    const provider = normalizeProviderId(run.ai_provider);
    return run.status === 'success'
      && activeOfferIds.has(run.offer_category_id)
      && provider !== null;
  });
  const successfulRunIds = new Set(successfulRuns.map((run) => run.id));
  const relevantMentions = args.mentions.filter((mention) => successfulRunIds.has(mention.offer_prompt_run_id));
  const runById = new Map(successfulRuns.map((run) => [run.id, run]));
  const dateKeys = buildDateKeys(args.window);
  const globalModelIds = Array.from(
    new Set(
      successfulRuns
        .map((run) => normalizeProviderId(run.ai_provider))
        .filter((provider): provider is Exclude<OverviewProviderId, 'all'> => provider !== null),
    ),
  ).sort((left, right) => {
    const leftIndex = PROVIDERS.findIndex((provider) => provider.id === left);
    const rightIndex = PROVIDERS.findIndex((provider) => provider.id === right);
    return leftIndex - rightIndex;
  });

  const products = activeOffers.map((offer) => {
    const offerRuns = successfulRuns.filter((run) => run.offer_category_id === offer.id);
    const offerRunIds = new Set(offerRuns.map((run) => run.id));
    const modelRunCounts = new Map<Exclude<OverviewProviderId, 'all'>, number>();
    const modelDailyRunIds = new Map<Exclude<OverviewProviderId, 'all'>, Map<string, Set<string>>>();
    for (const run of offerRuns) {
      const provider = normalizeProviderId(run.ai_provider);
      if (provider) {
        modelRunCounts.set(provider, (modelRunCounts.get(provider) || 0) + 1);
        const day = toDateKey(run.completed_at || run.created_at);
        const dailyMap = modelDailyRunIds.get(provider) || new Map<string, Set<string>>();
        const dayRuns = dailyMap.get(day) || new Set<string>();
        dayRuns.add(run.id);
        dailyMap.set(day, dayRuns);
        modelDailyRunIds.set(provider, dailyMap);
      }
    }

    const modelIds = Array.from(modelRunCounts.keys()).sort((left, right) => {
      const leftIndex = PROVIDERS.findIndex((provider) => provider.id === left);
      const rightIndex = PROVIDERS.findIndex((provider) => provider.id === right);
      return leftIndex - rightIndex;
    });

    type ActorAccumulator = {
      name: string;
      type: 'owned' | 'competitor' | 'third_party';
      models: Map<Exclude<OverviewProviderId, 'all'>, {
        mentionsCount: number;
        visibleRunIds: Set<string>;
        positionsByRun: Map<string, number[]>;
        dailyVisibleRunIds: Map<string, Set<string>>;
        dailyMentionsCount: Map<string, number>;
      }>;
    };

    const actors = new Map<string, ActorAccumulator>();
    const ownedName = args.projectName?.trim() || 'Votre marque';
    actors.set(normalizeEntityKey(ownedName, 'owned'), {
      name: ownedName,
      type: 'owned',
      models: new Map(),
    });

    for (const mention of relevantMentions) {
      if (!offerRunIds.has(mention.offer_prompt_run_id)) continue;
      const actorType = mentionActorType(mention.entity_type);
      if (!actorType) continue;

      const run = runById.get(mention.offer_prompt_run_id);
      const provider = normalizeProviderId(run?.ai_provider);
      if (!run || !provider) continue;

      const rawName = actorType === 'owned'
        ? ownedName
        : mention.entity_name.trim();
      if (!rawName) continue;

      const actorKey = normalizeEntityKey(rawName, actorType);
      const actor = actors.get(actorKey) || {
        name: rawName,
        type: actorType,
        models: new Map(),
      };
      const modelStats = actor.models.get(provider) || {
        mentionsCount: 0,
        visibleRunIds: new Set<string>(),
        positionsByRun: new Map<string, number[]>(),
        dailyVisibleRunIds: new Map<string, Set<string>>(),
        dailyMentionsCount: new Map<string, number>(),
      };

      modelStats.mentionsCount += 1;
      modelStats.visibleRunIds.add(mention.offer_prompt_run_id);
      const day = toDateKey(run.completed_at || run.created_at);
      const visibleDayRuns = modelStats.dailyVisibleRunIds.get(day) || new Set<string>();
      visibleDayRuns.add(mention.offer_prompt_run_id);
      modelStats.dailyVisibleRunIds.set(day, visibleDayRuns);
      modelStats.dailyMentionsCount.set(day, (modelStats.dailyMentionsCount.get(day) || 0) + 1);
      if (typeof mention.position === 'number' && Number.isFinite(mention.position) && mention.position > 0) {
        const positions = modelStats.positionsByRun.get(mention.offer_prompt_run_id) || [];
        positions.push(mention.position);
        modelStats.positionsByRun.set(mention.offer_prompt_run_id, positions);
      }

      actor.models.set(provider, modelStats);
      actors.set(actorKey, actor);
    }

    const competitors = Array.from(actors.values())
      .map((actor) => {
        const models = modelIds.map((model) => {
          const stats = actor.models.get(model);
          const totalRuns = modelRunCounts.get(model) || 0;
          const positions = stats
            ? Array.from(stats.positionsByRun.values()).map((values) => Math.min(...values))
            : [];

          return {
            model,
            label: providerOption(model).label,
            averagePosition: average(positions),
            appearanceRate: totalRuns > 0 && stats ? round(stats.visibleRunIds.size / totalRuns, 3) : 0,
            mentionsCount: stats?.mentionsCount || 0,
            totalRuns,
            trend: dateKeys.map((date) => {
              const dailyTotalRuns = modelDailyRunIds.get(model)?.get(date)?.size || 0;
              const dailyVisibleRuns = stats?.dailyVisibleRunIds.get(date)?.size || 0;
              return {
                date,
                visibilityRate: dailyTotalRuns > 0 ? round(dailyVisibleRuns / dailyTotalRuns, 3) : null,
                mentionsCount: stats?.dailyMentionsCount.get(date) || 0,
                totalRuns: dailyTotalRuns,
              };
            }),
          };
        });
        const visibleModels = models.filter((model) => model.averagePosition !== null);
        const globalPosition = average(visibleModels.map((model) => Number(model.averagePosition)));
        const totalMentions = models.reduce((sum, model) => sum + model.mentionsCount, 0);
        const totalAppearance = models.reduce((sum, model) => sum + model.appearanceRate, 0);

        return {
          name: actor.name,
          type: actor.type,
          models,
          globalPosition,
          totalMentions,
          totalAppearance,
        };
      })
      .filter((actor) => actor.type === 'owned' || actor.totalMentions > 0)
      .sort((left, right) => {
        if (left.type === 'owned' && right.type !== 'owned' && left.totalMentions === 0 && right.totalMentions === 0) return -1;
        if (left.globalPosition === null && right.globalPosition !== null) return 1;
        if (left.globalPosition !== null && right.globalPosition === null) return -1;
        if (left.globalPosition !== null && right.globalPosition !== null && left.globalPosition !== right.globalPosition) {
          return left.globalPosition - right.globalPosition;
        }
        if (left.totalMentions !== right.totalMentions) return right.totalMentions - left.totalMentions;
        if (left.totalAppearance !== right.totalAppearance) return right.totalAppearance - left.totalAppearance;
        return left.name.localeCompare(right.name, 'fr');
      })
      .slice(0, 10)
      .map(({ globalPosition: _globalPosition, totalMentions: _totalMentions, totalAppearance: _totalAppearance, ...actor }) => actor);

    return {
      productOrServiceId: offer.id,
      productOrServiceName: offer.name,
      type: offer.type,
      totalRuns: offerRuns.length,
      availableModels: modelIds.map(providerOption),
      competitors,
    };
  });

  return {
    availableModels: globalModelIds.map(providerOption),
    products,
  };
}

async function loadRunsForWindow(args: {
  supabase: any;
  offerIds: string[];
  window: ProductVisibilityDateWindow;
}) {
  if (args.offerIds.length === 0) return [];
  const { data, error } = await args.supabase
    .from('offer_prompt_runs')
    .select('id, offer_prompt_id, offer_category_id, ai_provider, prompt, answer, status, error_message, created_at, completed_at')
    .in('offer_category_id', args.offerIds)
    .gte('created_at', `${args.window.startDate}T00:00:00.000Z`)
    .lte('created_at', `${args.window.endDate}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
    .limit(2500);

  if (error) throw new Error(error.message);
  return (data || []) as RunRow[];
}

async function loadMentionsForRuns(supabase: any, runs: RunRow[]) {
  const runIds = runs.map((run) => run.id);
  if (runIds.length === 0) return [];
  const { data, error } = await supabase
    .from('offer_visibility_mentions')
    .select('id, offer_prompt_run_id, offer_category_id, entity_name, entity_type, matched_domain, position, is_recommended')
    .in('offer_prompt_run_id', runIds)
    .limit(5000);

  if (error) throw new Error(error.message);
  return (data || []) as MentionRow[];
}

export function resolveOverviewRange(url: string) {
  const { searchParams } = new URL(url);
  const range = parseRange(searchParams.get('range'), '30d');
  const selectedProvider = parseOverviewProvider(searchParams.get('provider'));
  const window = buildWindowFromDays(rangeToDays(range));
  const previousWindow = buildPreviousWindow(window);
  return { range, selectedProvider, window, previousWindow };
}

export async function getOverview(args: {
  supabase: any;
  projectId: string;
  projectName?: string | null;
  range: ProductVisibilityRange;
  selectedProvider: OverviewProviderId;
  window: ProductVisibilityDateWindow;
  previousWindow: ProductVisibilityDateWindow;
}): Promise<OverviewResponse> {
  const { data: offersData, error: offersError } = await args.supabase
    .from('offer_categories')
    .select('id, name, type, business_priority, is_active')
    .eq('project_id', args.projectId)
    .order('created_at', { ascending: false });

  if (offersError) throw new Error(offersError.message);

  const offers = (offersData || []) as OfferRow[];
  const activeOffers = offers.filter((offer) => offer.is_active);
  const offerIds = offers.map((offer) => offer.id);

  const [intentsRes, promptsRes, allRunsRes, currentRuns, previousRuns] = await Promise.all([
    offerIds.length
      ? args.supabase
          .from('offer_intents')
          .select('id, offer_category_id, label, intent_type, is_active')
          .in('offer_category_id', offerIds)
      : Promise.resolve({ data: [], error: null }),
    offerIds.length
      ? args.supabase
          .from('offer_prompts')
          .select('id, offer_category_id, offer_intent_id, prompt, ai_provider, is_active')
          .in('offer_category_id', offerIds)
      : Promise.resolve({ data: [], error: null }),
    offerIds.length
      ? args.supabase
          .from('offer_prompt_runs')
          .select('id, offer_prompt_id, offer_category_id, ai_provider, prompt, answer, status, error_message, created_at, completed_at')
          .in('offer_category_id', offerIds)
          .order('created_at', { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    loadRunsForWindow({ supabase: args.supabase, offerIds, window: args.window }),
    loadRunsForWindow({ supabase: args.supabase, offerIds, window: args.previousWindow }),
  ]);

  const firstError = intentsRes.error || promptsRes.error || allRunsRes.error;
  if (firstError) throw new Error(firstError.message);

  const intents = (intentsRes.data || []) as IntentRow[];
  const prompts = (promptsRes.data || []) as PromptRow[];
  const allRuns = (allRunsRes.data || []) as RunRow[];
  const [currentMentions, previousMentions, allMentions] = await Promise.all([
    loadMentionsForRuns(args.supabase, currentRuns),
    loadMentionsForRuns(args.supabase, previousRuns),
    loadMentionsForRuns(args.supabase, allRuns),
  ]);

  const offerById = new Map(offers.map((offer) => [offer.id, offer]));
  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const intentById = new Map(intents.map((intent) => [intent.id, intent]));
  const activePromptCount = prompts.filter((prompt) => prompt.is_active && offerById.get(prompt.offer_category_id)?.is_active).length;
  const configuredProviderIds = new Set(
    PROVIDERS.filter((provider) => providerHasKey(provider)).map((provider) => provider.id),
  );

  const current = aggregateMetrics({
    offers,
    runs: currentRuns,
    mentions: currentMentions,
    selectedProvider: args.selectedProvider,
    configuredProviderIds,
  });
  const competitivePosition = buildCompetitiveAIPosition({
    offers,
    runs: currentRuns,
    mentions: currentMentions,
    window: args.window,
    projectName: args.projectName,
  });
  const previous = aggregateMetrics({
    offers,
    runs: previousRuns,
    mentions: previousMentions,
    selectedProvider: args.selectedProvider,
    configuredProviderIds,
  });
  const currentProducts = aggregateMetrics({
    offers: offers.filter((offer) => offer.type === 'product_category'),
    runs: currentRuns,
    mentions: currentMentions,
    selectedProvider: args.selectedProvider,
    configuredProviderIds,
  });
  const previousProducts = aggregateMetrics({
    offers: offers.filter((offer) => offer.type === 'product_category'),
    runs: previousRuns,
    mentions: previousMentions,
    selectedProvider: args.selectedProvider,
    configuredProviderIds,
  });
  const currentServices = aggregateMetrics({
    offers: offers.filter((offer) => offer.type === 'service'),
    runs: currentRuns,
    mentions: currentMentions,
    selectedProvider: args.selectedProvider,
    configuredProviderIds,
  });
  const previousServices = aggregateMetrics({
    offers: offers.filter((offer) => offer.type === 'service'),
    runs: previousRuns,
    mentions: previousMentions,
    selectedProvider: args.selectedProvider,
    configuredProviderIds,
  });

  const activeOfferIds = new Set(activeOffers.map((offer) => offer.id));
  const selectedConfiguredProvider = args.selectedProvider === 'all'
    ? null
    : PROVIDERS.find((provider) => provider.id === args.selectedProvider && providerHasKey(provider)) || null;
  const selectedProviderMissing = args.selectedProvider !== 'all' && !selectedConfiguredProvider;
  const successfulCurrentRuns = currentRuns.filter((run) => run.status === 'success' && activeOfferIds.has(run.offer_category_id));
  const hasSuccessfulRunsForSelection = current.successfulRuns.length > 0;
  const hasRunsEver = allRuns.some((run) => activeOfferIds.has(run.offer_category_id));
  const hasResults = current.ownedMentions.length > 0 || current.competitorMentions.length > 0;

  const providerRows = PROVIDERS.map((provider) => {
    const configured = providerHasKey(provider);
    const providerRuns = currentRuns.filter(
      (run) => configured && normalizeProviderId(run.ai_provider) === provider.id && run.status === 'success' && activeOfferIds.has(run.offer_category_id),
    );
    const providerRunIds = new Set(providerRuns.map((run) => run.id));
    const providerMentions = currentMentions.filter((mention) => providerRunIds.has(mention.offer_prompt_run_id));
    const providerOwned = providerMentions.filter((mention) => mention.entity_type === 'own_brand');
    const providerCompetitor = providerMentions.filter((mention) => mention.entity_type === 'competitor');
    const providerPositions = providerOwned
      .map((mention) => mention.position)
      .filter((position): position is number => typeof position === 'number' && Number.isFinite(position) && position > 0);
    const providerVisibleOffers = new Set(providerOwned.map((mention) => mention.offer_category_id)).size;
    const latestProviderRun = currentRuns.find((run) => normalizeProviderId(run.ai_provider) === provider.id);
    const hasError = currentRuns.some((run) => normalizeProviderId(run.ai_provider) === provider.id && run.status === 'failed');
    const averagePosition = average(providerPositions);
    const hasData = providerRuns.length > 0;

    return {
      id: provider.id,
      label: provider.label,
      status: (configured ? (hasError && !hasData ? 'error' : 'configured') : 'missing_api_key') as OverviewProviderStatus,
      hasData,
      visibilityScore: hasData
        ? scoreFromMentions(providerOwned.length, providerCompetitor.length, averagePosition)
        : null,
      visibleOffers: hasData ? providerVisibleOffers : null,
      ownedMentions: hasData ? providerOwned.length : null,
      competitorMentions: hasData ? providerCompetitor.length : null,
      averagePosition,
      lastRunAt: latestProviderRun?.completed_at || latestProviderRun?.created_at || null,
    };
  });

  const runById = new Map([...currentRuns, ...allRuns].map((run) => [run.id, run]));
  const offerStats = activeOffers.map((offer) => {
    const offerRuns = current.successfulRuns.filter((run) => run.offer_category_id === offer.id);
    const offerRunIds = new Set(offerRuns.map((run) => run.id));
    const owned = current.ownedMentions.filter((mention) => mention.offer_category_id === offer.id);
    const competitors = current.competitorMentions.filter((mention) => mention.offer_category_id === offer.id);
    const positions = owned
      .map((mention) => mention.position)
      .filter((position): position is number => typeof position === 'number' && Number.isFinite(position) && position > 0);
    const topCompetitor = Array.from(
      competitors.reduce((map, mention) => {
        const key = mention.entity_name.trim();
        if (!key) return map;
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const providerCounts = new Map<string, number>();
    for (const run of offerRuns) {
      const provider = normalizeProviderId(run.ai_provider);
      if (provider) providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    }
    const dominantProvider = Array.from(providerCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const latestRunAt = offerRuns
      .map((run) => run.completed_at || run.created_at)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0] || null;
    const visibilityScore = offerRuns.length > 0
      ? scoreFromMentions(owned.length, competitors.length, average(positions))
      : null;
    const opportunityScore = offerRuns.length > 0
      ? clamp((competitors.length - owned.length) * 12 + (visibilityScore === null ? 25 : 70 - visibilityScore), 0, 100)
      : 0;

    return {
      offer,
      owned,
      competitors,
      visibilityScore,
      topCompetitor,
      dominantProvider,
      latestRunAt,
      opportunityScore,
      hasRuns: offerRunIds.size > 0,
    };
  });

  const topVisibleOffers = offerStats
    .filter((stat) => stat.hasRuns && stat.owned.length > 0)
    .sort((left, right) => {
      const scoreDiff = (right.visibilityScore || 0) - (left.visibilityScore || 0);
      return scoreDiff !== 0 ? scoreDiff : right.owned.length - left.owned.length;
    })
    .slice(0, 6)
    .map((stat) => ({
      id: stat.offer.id,
      name: stat.offer.name,
      type: stat.offer.type === 'service' ? 'Service' : 'Catégorie produit',
      visibilityScore: stat.visibilityScore,
      ownedMentions: stat.owned.length,
      competitorMentions: stat.competitors.length,
      aiProvider: stat.dominantProvider,
      lastRunAt: stat.latestRunAt,
    }));

  const invisibleOffers = offerStats
    .filter((stat) => stat.hasRuns && stat.owned.length === 0)
    .sort((left, right) => right.competitors.length - left.competitors.length)
    .slice(0, 6)
    .map((stat) => ({
      id: stat.offer.id,
      name: stat.offer.name,
      type: stat.offer.type === 'service' ? 'Service' : 'Catégorie produit',
      visibilityScore: stat.visibilityScore,
      competitorMentions: stat.competitors.length,
      topCompetitor: stat.topCompetitor,
      aiProvider: stat.dominantProvider,
      reason: stat.competitors.length > 0
        ? 'Des concurrents sont recommandés sur les mêmes questions.'
        : 'Aucune mention détectée sur les analyses de la période.',
    }));

  const priorityOffers = offerStats
    .filter((stat) => stat.hasRuns && stat.competitors.length > 0 && stat.opportunityScore >= 25)
    .sort((left, right) => right.opportunityScore - left.opportunityScore)
    .slice(0, 6)
    .map((stat) => ({
      id: stat.offer.id,
      name: stat.offer.name,
      category: stat.offer.type === 'service' ? 'Service' : 'Catégorie produit',
      visibilityScore: stat.visibilityScore,
      competitorMentions: stat.competitors.length,
      topCompetitor: stat.topCompetitor,
      aiProvider: stat.dominantProvider,
      opportunityLevel: opportunityLevel(stat.opportunityScore),
      recommendedAction:
        stat.owned.length === 0
          ? 'Créer ou enrichir une page dédiée avec preuves, prix, disponibilité et cas d’usage.'
          : 'Renforcer les attributs différenciants et ajouter des preuves comparatives.',
    }));

  const priorityOpportunities = hasSuccessfulRunsForSelection ? priorityOffers.length : null;

  const competitorMap = new Map<string, {
    name: string;
    categories: Set<string>;
    mentions: number;
    providerCounts: Map<string, number>;
    sources: Set<string>;
  }>();
  for (const mention of current.competitorMentions) {
    const name = mention.entity_name.trim();
    if (!name) continue;
    const currentEntry = competitorMap.get(name.toLowerCase()) || {
      name,
      categories: new Set<string>(),
      mentions: 0,
      providerCounts: new Map<string, number>(),
      sources: new Set<string>(),
    };
    currentEntry.mentions += 1;
    const offer = offerById.get(mention.offer_category_id);
    if (offer) currentEntry.categories.add(offer.name);
    const run = runById.get(mention.offer_prompt_run_id);
    const provider = normalizeProviderId(run?.ai_provider);
    if (provider) currentEntry.providerCounts.set(provider, (currentEntry.providerCounts.get(provider) || 0) + 1);
    if (mention.matched_domain) currentEntry.sources.add(mention.matched_domain);
    competitorMap.set(name.toLowerCase(), currentEntry);
  }

  const ownedByCategory = new Map<string, number>();
  for (const mention of current.ownedMentions) {
    ownedByCategory.set(mention.offer_category_id, (ownedByCategory.get(mention.offer_category_id) || 0) + 1);
  }
  const topCompetitors = Array.from(competitorMap.values())
    .map((competitor) => {
      const ownedInCategories = Array.from(competitor.categories).reduce((sum, categoryName) => {
        const offer = activeOffers.find((item) => item.name === categoryName);
        return sum + (offer ? ownedByCategory.get(offer.id) || 0 : 0);
      }, 0);
      return {
        name: competitor.name,
        categories: Array.from(competitor.categories).slice(0, 4),
        mentions: competitor.mentions,
        dominantProvider: Array.from(competitor.providerCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null,
        gapVsOwned: competitor.mentions - ownedInCategories,
        sources: Array.from(competitor.sources).slice(0, 3),
      };
    })
    .sort((left, right) => right.mentions - left.mentions)
    .slice(0, 6);

  const questionMap = new Map<string, {
    id: string;
    question: string;
    category: string | null;
    buyingIntent: string | null;
    providerCounts: Map<string, number>;
    owned: number;
    competitors: number;
    lastRunAt: string | null;
  }>();
  for (const run of current.successfulRuns) {
    const prompt = promptById.get(run.offer_prompt_id);
    const offer = offerById.get(run.offer_category_id);
    const intent = prompt?.offer_intent_id ? intentById.get(prompt.offer_intent_id) : null;
    const key = run.offer_prompt_id || run.prompt;
    const entry = questionMap.get(key) || {
      id: key,
      question: prompt?.prompt || run.prompt,
      category: offer?.name || null,
      buyingIntent: intent?.intent_type || null,
      providerCounts: new Map<string, number>(),
      owned: 0,
      competitors: 0,
      lastRunAt: run.completed_at || run.created_at || null,
    };
    const provider = normalizeProviderId(run.ai_provider);
    if (provider) entry.providerCounts.set(provider, (entry.providerCounts.get(provider) || 0) + 1);
    const runMentions = current.relevantMentions.filter((mention) => mention.offer_prompt_run_id === run.id);
    entry.owned += runMentions.filter((mention) => mention.entity_type === 'own_brand').length;
    entry.competitors += runMentions.filter((mention) => mention.entity_type === 'competitor').length;
    if ((run.completed_at || run.created_at) > (entry.lastRunAt || '')) {
      entry.lastRunAt = run.completed_at || run.created_at;
    }
    questionMap.set(key, entry);
  }

  const importantQuestions = Array.from(questionMap.values())
    .map((question) => {
      const total = question.owned + question.competitors;
      const competitorPressure = total > 0 ? question.competitors / total : 0;
      const score = total > 0 ? round(clamp(total * 8 + competitorPressure * 40, 0, 100), 1) : null;
      return {
        id: question.id,
        question: question.question,
        category: question.category,
        buyingIntent: question.buyingIntent,
        aiProvider: Array.from(question.providerCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null,
        ownedOffersMentioned: question.owned,
        competitorsMentioned: question.competitors,
        score,
        lastRunAt: question.lastRunAt,
      };
    })
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 8);

  const insights: OverviewResponse['insights'] = [];
  const bestProvider = providerRows
    .filter((provider) => provider.visibilityScore !== null)
    .sort((left, right) => (right.visibilityScore || 0) - (left.visibilityScore || 0))[0];
  const weakestProvider = providerRows
    .filter((provider) => provider.visibilityScore !== null)
    .sort((left, right) => (left.visibilityScore || 0) - (right.visibilityScore || 0))[0];

  if (bestProvider && weakestProvider && bestProvider.id !== weakestProvider.id) {
    insights.push({
      title: 'Visibilité inégale selon les moteurs IA',
      description: `Vos offres performent mieux sur ${bestProvider.label} que sur ${weakestProvider.label}.`,
      evidence: `${bestProvider.label} : ${bestProvider.visibilityScore} %. ${weakestProvider.label} : ${weakestProvider.visibilityScore} %.`,
      priority: (weakestProvider.visibilityScore || 0) < 40 ? 'high' : 'medium',
      recommendedAction: `Prioriser les contenus et sources qui répondent aux questions analysées sur ${weakestProvider.label}.`,
    });
  }

  const topCompetitor = topCompetitors[0];
  if (topCompetitor) {
    insights.push({
      title: 'Un concurrent capte une part importante des recommandations',
      description: `${topCompetitor.name} est le concurrent le plus visible sur vos catégories suivies.`,
      evidence: `${topCompetitor.mentions} mentions concurrentes détectées, écart de ${topCompetitor.gapVsOwned ?? 0} mention(s) vs vos offres.`,
      priority: topCompetitor.gapVsOwned !== null && topCompetitor.gapVsOwned > 3 ? 'high' : 'medium',
      recommendedAction: 'Analyser ses pages et créer des contenus comparatifs sur les questions où il ressort.',
    });
  }

  const firstPriorityOffer = priorityOffers[0];
  if (firstPriorityOffer) {
    insights.push({
      title: 'Une offre présente un fort potentiel de progression',
      description: `${firstPriorityOffer.name} est dominée par des concurrents sur la période sélectionnée.`,
      evidence: `${firstPriorityOffer.competitorMentions} mentions concurrentes détectées. Meilleur concurrent : ${firstPriorityOffer.topCompetitor || 'non identifié'}.`,
      priority: firstPriorityOffer.opportunityLevel === 'high' ? 'high' : 'medium',
      recommendedAction: firstPriorityOffer.recommendedAction,
    });
  }

  if (current.averagePosition !== null && current.averagePosition > 3) {
    insights.push({
      title: 'Vos offres sont citées trop bas dans les réponses',
      description: 'Les IA citent vos offres, mais pas assez souvent en première position.',
      evidence: `Position moyenne : ${current.averagePosition}.`,
      priority: 'medium',
      recommendedAction: 'Renforcer les preuves de crédibilité : avis, cas clients, prix, disponibilité et différenciation.',
    });
  }

  if (current.ownedMentions.length === 0 && current.competitorMentions.length > 0) {
    insights.push({
      title: 'Les concurrents apparaissent là où vos offres sont absentes',
      description: 'Les moteurs IA recommandent des alternatives concurrentes sans citer vos offres.',
      evidence: `${current.competitorMentions.length} mentions concurrentes, aucune mention de vos offres sur la sélection.`,
      priority: 'high',
      recommendedAction: 'Ajouter des pages offres plus explicites et enrichir les questions d’achat prioritaires.',
    });
  }

  const latestRunWithAnswer = current.successfulRuns.find((run) => Boolean(run.answer));
  const sampleMentions = latestRunWithAnswer
    ? current.relevantMentions.filter((mention) => mention.offer_prompt_run_id === latestRunWithAnswer.id)
    : [];
  const sampleResponse = latestRunWithAnswer
    ? {
        aiProvider: normalizeProviderId(latestRunWithAnswer.ai_provider) || latestRunWithAnswer.ai_provider || 'openai',
        question: latestRunWithAnswer.prompt,
        date: latestRunWithAnswer.completed_at || latestRunWithAnswer.created_at,
        excerpt: String(latestRunWithAnswer.answer || '').slice(0, 700),
        detectedOwnedOffers: distinctStrings(sampleMentions.filter((mention) => mention.entity_type === 'own_brand').map((mention) => mention.entity_name)),
        detectedCompetitors: distinctStrings(sampleMentions.filter((mention) => mention.entity_type === 'competitor').map((mention) => mention.entity_name)),
        detectedBrands: distinctStrings(sampleMentions.map((mention) => mention.entity_name)),
        responseId: latestRunWithAnswer.id,
      }
    : null;

  const ownedMentionRows = current.ownedMentions.slice(0, 10).map((mention) => {
    const offer = offerById.get(mention.offer_category_id);
    const run = runById.get(mention.offer_prompt_run_id);
    return {
      label: mention.entity_name || offer?.name || 'Offre détectée',
      value: offer?.name || 'Offre non renseignée',
      description: `${normalizeProviderId(run?.ai_provider) || run?.ai_provider || 'Moteur non renseigné'} · ${run?.prompt || 'Question non renseignée'}`,
      href: offer ? `/offers/${offer.id}` : '/offers',
    };
  });

  const positionRows = current.ownedMentions
    .filter((mention) => typeof mention.position === 'number' && Number.isFinite(mention.position))
    .sort((left, right) => Number(left.position) - Number(right.position))
    .slice(0, 10)
    .map((mention) => {
      const offer = offerById.get(mention.offer_category_id);
      const run = runById.get(mention.offer_prompt_run_id);
      return {
        label: mention.entity_name || offer?.name || 'Offre détectée',
        value: `Position ${mention.position}`,
        description: `${normalizeProviderId(run?.ai_provider) || run?.ai_provider || 'Moteur non renseigné'} · ${run?.prompt || 'Question non renseignée'}`,
        href: offer ? `/offers/${offer.id}` : '/offers',
      };
    });

  const kpiDetails: OverviewResponse['kpiDetails'] = {
    trackedOffers: {
      title: 'Détail des offres suivies',
      explanation: 'Ce chiffre correspond aux offres actives que Quorum surveille pour cette marque.',
      formula: 'Nombre d’offres actives dans offer_categories.',
      source: 'Table Supabase : offer_categories.',
      href: '/offers',
      ctaLabel: 'Voir les offres suivies',
      rows: activeOffers.slice(0, 10).map((offer) => ({
        label: offer.name,
        value: offer.type === 'service' ? 'Service' : 'Catégorie produit',
        description: offer.business_priority ? `Priorité ${offer.business_priority}` : 'Offre active',
        href: `/offers/${offer.id}`,
      })),
      emptyMessage: 'Aucune offre active n’est suivie pour le moment.',
    },
    visibleOffers: {
      title: 'Détail des offres visibles',
      explanation: 'Une offre est visible lorsqu’elle est détectée au moins une fois dans une réponse IA sur la période sélectionnée.',
      formula: 'Nombre d’offres distinctes avec au moins une mention own_brand.',
      source: 'Tables Supabase : offer_prompt_runs et offer_visibility_mentions.',
      href: '/offers',
      ctaLabel: 'Voir les offres visibles',
      rows: offerStats
        .filter((stat) => stat.owned.length > 0)
        .sort((left, right) => right.owned.length - left.owned.length)
        .slice(0, 10)
        .map((stat) => ({
          label: stat.offer.name,
          value: pluralize(stat.owned.length, 'mention', 'mentions'),
          description: `Score de visibilité : ${stat.visibilityScore === null ? 'Données insuffisantes' : `${stat.visibilityScore} %`}`,
          href: `/offers/${stat.offer.id}`,
        })),
      emptyMessage: 'Aucune offre visible n’a été détectée sur cette période.',
    },
    ownedMentions: {
      title: 'Détail des mentions de vos offres',
      explanation: 'Chaque ligne correspond à une détection de votre marque ou offre dans une réponse IA analysée.',
      formula: 'Nombre de mentions avec entity_type = own_brand.',
      source: 'Table Supabase : offer_visibility_mentions.',
      href: '/offers',
      ctaLabel: 'Voir les analyses des offres',
      rows: ownedMentionRows,
      emptyMessage: 'Aucune mention de vos offres sur cette période.',
    },
    competitorMentions: {
      title: 'Détail des mentions concurrentes',
      explanation: 'Ces mentions montrent les concurrents détectés dans les mêmes réponses IA que vos catégories suivies.',
      formula: 'Nombre de mentions avec entity_type = competitor.',
      source: 'Table Supabase : offer_visibility_mentions.',
      href: '/concurrents',
      ctaLabel: 'Voir les concurrents',
      rows: topCompetitors.map((competitor) => ({
        label: competitor.name,
        value: pluralize(competitor.mentions, 'mention', 'mentions'),
        description: `Catégories : ${competitor.categories.join(', ') || 'non renseignées'} · Moteur dominant : ${competitor.dominantProvider || 'non renseigné'}`,
        href: '/concurrents',
      })),
      emptyMessage: 'Aucune mention concurrente sur cette période.',
    },
    averagePosition: {
      title: 'Détail de la position moyenne',
      explanation: 'La position moyenne indique à quel rang vos offres apparaissent lorsqu’elles sont citées.',
      formula: 'Moyenne des positions des mentions own_brand avec une position détectée.',
      source: 'Champ position dans offer_visibility_mentions.',
      href: '/offers',
      ctaLabel: 'Voir les offres analysées',
      rows: positionRows,
      emptyMessage: 'Aucune position exploitable sur cette période.',
    },
    priorityOpportunities: {
      title: 'Détail des opportunités prioritaires',
      explanation: 'Une opportunité prioritaire est une offre où les concurrents ressortent davantage que vos propres offres.',
      formula: 'Offres analysées avec mentions concurrentes et score d’opportunité significatif.',
      source: 'Agrégation de offer_prompt_runs et offer_visibility_mentions.',
      href: '/offers',
      ctaLabel: 'Voir les offres à améliorer',
      rows: priorityOffers.map((offer) => ({
        label: offer.name,
        value: offer.opportunityLevel === 'high' ? 'Forte' : offer.opportunityLevel === 'medium' ? 'Moyenne' : 'Faible',
        description: `${pluralize(offer.competitorMentions, 'mention concurrente', 'mentions concurrentes')} · ${offer.recommendedAction}`,
        href: `/offers/${offer.id}`,
      })),
      emptyMessage: 'Aucune opportunité prioritaire détectée pour le moment.',
    },
  };

  let state: OverviewResponse['state'];
  if (activeOffers.length === 0) {
    state = {
      hasTrackedOffers: false,
      hasQueries: false,
      hasRuns: false,
      hasResults: false,
      message: 'Ajoutez vos premières offres pour mesurer leur visibilité IA.',
      nextAction: { label: 'Ajouter une offre', href: '/offers' },
    };
  } else if (activePromptCount === 0) {
    state = {
      hasTrackedOffers: true,
      hasQueries: false,
      hasRuns: false,
      hasResults: false,
      message: 'Vos offres sont prêtes. Générez maintenant vos questions d’achat IA.',
      nextAction: { label: 'Générer les questions IA', href: '/offers' },
    };
  } else if (!hasRunsEver) {
    state = {
      hasTrackedOffers: true,
      hasQueries: true,
      hasRuns: false,
      hasResults: false,
      message: 'Lancez votre première analyse pour obtenir vos scores.',
      nextAction: { label: 'Lancer l’analyse', action: 'run_overview_analysis' },
    };
  } else if (!hasResults) {
    state = {
      hasTrackedOffers: true,
      hasQueries: true,
      hasRuns: true,
      hasResults: false,
      message: selectedProviderMissing
        ? 'Ce moteur IA n’est pas encore configuré.'
        : 'Analyse terminée, mais aucune offre n’a été détectée.',
      nextAction: { label: 'Voir les offres suivies', href: '/offers' },
    };
  } else {
    state = {
      hasTrackedOffers: true,
      hasQueries: true,
      hasRuns: true,
      hasResults: true,
      message: selectedProviderMissing ? 'Ce moteur IA n’est pas encore configuré.' : 'Données disponibles.',
      nextAction: { label: 'Lancer une analyse', action: 'run_overview_analysis' },
    };
  }

  return {
    period: {
      range: args.range,
      currentStart: args.window.startDate,
      currentEnd: args.window.endDate,
      previousStart: args.previousWindow.startDate,
      previousEnd: args.previousWindow.endDate,
    },
    selectedProvider: args.selectedProvider,
    kpis: {
      globalVisibilityScore: current.productVisibilityScore,
      productVisibilityScore: currentProducts.productVisibilityScore,
      serviceVisibilityScore: currentServices.productVisibilityScore,
      trackedOffers: activeOffers.length,
      trackedProducts: activeOffers.filter((offer) => offer.type === 'product_category').length,
      trackedServices: activeOffers.filter((offer) => offer.type === 'service').length,
      visibleOffers: hasSuccessfulRunsForSelection ? current.visibleOfferIds.size : null,
      visibleProducts: currentProducts.successfulRuns.length > 0 ? currentProducts.visibleOfferIds.size : null,
      visibleServices: currentServices.successfulRuns.length > 0 ? currentServices.visibleOfferIds.size : null,
      ownedMentions: hasSuccessfulRunsForSelection ? current.ownedMentions.length : null,
      competitorMentions: hasSuccessfulRunsForSelection ? current.competitorMentions.length : null,
      averagePosition: current.averagePosition,
      priorityOpportunities,
    },
    deltas: {
      globalVisibilityScore: diffOrNull(current.productVisibilityScore, previous.productVisibilityScore, 1),
      productVisibilityScore: diffOrNull(currentProducts.productVisibilityScore, previousProducts.productVisibilityScore, 1),
      serviceVisibilityScore: diffOrNull(currentServices.productVisibilityScore, previousServices.productVisibilityScore, 1),
      visibleOffers: diffOrNull(
        hasSuccessfulRunsForSelection ? current.visibleOfferIds.size : null,
        previous.successfulRuns.length > 0 ? previous.visibleOfferIds.size : null,
        0,
      ),
      ownedMentions: diffOrNull(
        hasSuccessfulRunsForSelection ? current.ownedMentions.length : null,
        previous.successfulRuns.length > 0 ? previous.ownedMentions.length : null,
        0,
      ),
      competitorMentions: diffOrNull(
        hasSuccessfulRunsForSelection ? current.competitorMentions.length : null,
        previous.successfulRuns.length > 0 ? previous.competitorMentions.length : null,
        0,
      ),
      averagePosition: diffOrNull(current.averagePosition, previous.averagePosition, 1),
      priorityOpportunities: null,
    },
    providers: providerRows,
    priorityOffers,
    topVisibleOffers,
    invisibleOffers,
    topCompetitors,
    importantQuestions,
    insights: insights.slice(0, 5),
    sampleResponse,
    competitivePosition,
    state,
    kpiDetails,
  };
}

export async function runOverviewAnalysis(args: {
  supabase: any;
  projectId: string;
  maxOffers?: number;
  maxPrompts?: number;
}) {
  const { data, error } = await args.supabase
    .from('offer_categories')
    .select('id')
    .eq('project_id', args.projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(args.maxOffers || 5);

  if (error) throw new Error(error.message);

  const offerIds = ((data || []) as Array<{ id: string }>).map((offer) => offer.id);
  const results = [];
  for (const offerId of offerIds) {
    try {
      results.push(await runOfferAnalysis({
        supabase: args.supabase,
        projectId: args.projectId,
        offerId,
        maxPrompts: args.maxPrompts || 3,
      }));
    } catch (error) {
      results.push({
        offer_id: offerId,
        ok: false,
        error: error instanceof Error ? error.message : 'Analyse impossible.',
      });
    }
  }

  return {
    offers_analyzed: results.length,
    results,
  };
}

export function emptyOverview(args: {
  range: ProductVisibilityRange;
  selectedProvider: OverviewProviderId;
  window: ProductVisibilityDateWindow;
  previousWindow: ProductVisibilityDateWindow;
}): OverviewResponse {
  return {
    period: {
      range: args.range,
      currentStart: args.window.startDate,
      currentEnd: args.window.endDate,
      previousStart: args.previousWindow.startDate,
      previousEnd: args.previousWindow.endDate,
    },
    selectedProvider: args.selectedProvider,
    kpis: {
      globalVisibilityScore: null,
      productVisibilityScore: null,
      serviceVisibilityScore: null,
      trackedOffers: 0,
      trackedProducts: 0,
      trackedServices: 0,
      visibleOffers: null,
      visibleProducts: null,
      visibleServices: null,
      ownedMentions: null,
      competitorMentions: null,
      averagePosition: null,
      priorityOpportunities: null,
    },
    deltas: {
      globalVisibilityScore: null,
      productVisibilityScore: null,
      serviceVisibilityScore: null,
      visibleOffers: null,
      ownedMentions: null,
      competitorMentions: null,
      averagePosition: null,
      priorityOpportunities: null,
    },
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      status: providerHasKey(provider) ? 'configured' : 'missing_api_key',
      hasData: false,
      visibilityScore: null,
      visibleOffers: null,
      ownedMentions: null,
      competitorMentions: null,
      averagePosition: null,
      lastRunAt: null,
    })),
    priorityOffers: [],
    topVisibleOffers: [],
    invisibleOffers: [],
    topCompetitors: [],
    importantQuestions: [],
    insights: [],
    sampleResponse: null,
    competitivePosition: {
      availableModels: [],
      products: [],
    },
    state: {
      hasTrackedOffers: false,
      hasQueries: false,
      hasRuns: false,
      hasResults: false,
      message: 'Données insuffisantes.',
      nextAction: null,
    },
    kpiDetails: {
      trackedOffers: {
        title: 'Détail des offres suivies',
        explanation: 'Ce chiffre correspond aux offres actives que Quorum surveille pour cette marque.',
        formula: 'Nombre d’offres actives dans offer_categories.',
        source: 'Table Supabase : offer_categories.',
        href: '/offers',
        ctaLabel: 'Voir les offres suivies',
        rows: [],
        emptyMessage: 'Aucune offre active n’est suivie pour le moment.',
      },
      visibleOffers: {
        title: 'Détail des offres visibles',
        explanation: 'Une offre est visible lorsqu’elle est détectée au moins une fois dans une réponse IA.',
        formula: 'Nombre d’offres distinctes avec au moins une mention own_brand.',
        source: 'Tables Supabase : offer_prompt_runs et offer_visibility_mentions.',
        href: '/offers',
        ctaLabel: 'Voir les offres visibles',
        rows: [],
        emptyMessage: 'Aucune offre visible n’a été détectée sur cette période.',
      },
      ownedMentions: {
        title: 'Détail des mentions de vos offres',
        explanation: 'Chaque ligne correspond à une détection de votre marque ou offre dans une réponse IA analysée.',
        formula: 'Nombre de mentions avec entity_type = own_brand.',
        source: 'Table Supabase : offer_visibility_mentions.',
        href: '/offers',
        ctaLabel: 'Voir les analyses des offres',
        rows: [],
        emptyMessage: 'Aucune mention de vos offres sur cette période.',
      },
      competitorMentions: {
        title: 'Détail des mentions concurrentes',
        explanation: 'Ces mentions montrent les concurrents détectés dans les réponses IA.',
        formula: 'Nombre de mentions avec entity_type = competitor.',
        source: 'Table Supabase : offer_visibility_mentions.',
        href: '/concurrents',
        ctaLabel: 'Voir les concurrents',
        rows: [],
        emptyMessage: 'Aucune mention concurrente sur cette période.',
      },
      averagePosition: {
        title: 'Détail de la position moyenne',
        explanation: 'La position moyenne indique à quel rang vos offres apparaissent lorsqu’elles sont citées.',
        formula: 'Moyenne des positions des mentions own_brand avec une position détectée.',
        source: 'Champ position dans offer_visibility_mentions.',
        href: '/offers',
        ctaLabel: 'Voir les offres analysées',
        rows: [],
        emptyMessage: 'Aucune position exploitable sur cette période.',
      },
      priorityOpportunities: {
        title: 'Détail des opportunités prioritaires',
        explanation: 'Une opportunité prioritaire est une offre où les concurrents ressortent davantage que vos propres offres.',
        formula: 'Offres analysées avec mentions concurrentes et score d’opportunité significatif.',
        source: 'Agrégation de offer_prompt_runs et offer_visibility_mentions.',
        href: '/offers',
        ctaLabel: 'Voir les offres à améliorer',
        rows: [],
        emptyMessage: 'Aucune opportunité prioritaire détectée pour le moment.',
      },
    },
  };
}

export { scoreStatus };
