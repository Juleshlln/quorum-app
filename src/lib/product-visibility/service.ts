import type {
  ProductAttributeLite,
  ProductCategoryLite,
  ProductLite,
  ProductVisibilityParsedResult,
  CitationLite,
} from '@/lib/product-visibility/parser';
import { parseProductVisibilityResponse } from '@/lib/product-visibility/parser';
import { generateProductPrompts } from '@/lib/product-visibility/prompt-generation';
import type { GeneratedProductPrompt } from '@/lib/product-visibility/prompt-generation';
import type { PromptLifecycleStatus } from '@/lib/product-visibility/prompt-types';

export type ProductVisibilityDateWindow = {
  startDate: string;
  endDate: string;
};

export type ProductVisibilityContext = {
  categories: ProductCategoryLite[];
  products: ProductLite[];
  productAttributes: ProductAttributeLite[];
  competitors: Array<{ id: string; name: string; domain: string | null }>;
};

type VisibilityRow = {
  id: string;
  project_id: string;
  run_id: string | null;
  prompt_id: string | null;
  prompt_run_id: string | null;
  product_id: string | null;
  category_id: string | null;
  ai_model: string | null;
  buying_intent: string | null;
  visibility_score: number | null;
  rank_position: number | null;
  mention_count: number | null;
  sentiment_score: number | null;
  accuracy_score: number | null;
  attributes_detected: unknown;
  sources_detected: unknown;
  raw_answer: string | null;
  analysis_json: unknown;
  is_owned_product: boolean | null;
  detected_product_name: string | null;
  detected_brand_name: string | null;
  confidence_score: number | null;
  created_at: string;
};

type RecommendationRow = {
  id: string;
  run_id: string | null;
  product_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  priority: string;
  expected_impact: string | null;
  effort: string | null;
  source_reason: string | null;
  status: string;
  created_at: string;
};

type PromptRow = {
  id: string;
  prompt_text: string;
  topic_id: string | null;
  category_id: string | null;
  buying_intent: string | null;
  scope?: string | null;
  intent?: string | null;
  quality_status?: string | null;
  lifecycle_status?: string | null;
  prompt_origin?: string | null;
  rationale?: string | null;
  locale?: string | null;
  topic_label: string | null;
  monitoring_frequency: string | null;
  is_active: boolean | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

// Seuil minimal d'échantillon pour considérer un KPI agrégé comme fiable.
// En dessous : on retourne quand même le chiffre (l'utilisateur le voit)
// mais on remonte `confidence_level: 'low'` pour que l'UI affiche un badge.
export const PRODUCT_VISIBILITY_MIN_SAMPLE = 5;

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [record.message, record.details, record.hint, record.code]
      .map((part) => typeof part === 'string' ? part.trim() : '')
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' - ');
  }
  return fallback;
}

function isMissingColumnError(error: unknown, columns: string[]) {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  const message = `${record.message || ''} ${record.details || ''} ${record.hint || ''}`.toLowerCase();
  const mentionsColumn = columns.some((column) => message.includes(column.toLowerCase()));
  return mentionsColumn && (
    record.code === '42703'
    || record.code === 'PGRST204'
    || message.includes('could not find')
    || message.includes('schema cache')
    || message.includes('column')
  );
}

function stripKeys<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const copy: Record<string, unknown> = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

async function insertProductVisibilityRows(args: {
  supabase: any;
  rows: Array<Record<string, unknown>>;
}) {
  const inserted = await args.supabase
    .from('product_visibility_results')
    .insert(args.rows);

  if (!inserted.error) return;

  const detectedColumns = ['detected_product_name', 'detected_brand_name', 'confidence_score'];
  if (!isMissingColumnError(inserted.error, detectedColumns)) {
    throw new Error(getErrorMessage(inserted.error, 'Impossible d’insérer les résultats de visibilité produit.'));
  }

  const legacyRows = args.rows.map((row) => stripKeys(row, detectedColumns));
  const legacyInserted = await args.supabase
    .from('product_visibility_results')
    .insert(legacyRows);

  if (legacyInserted.error) {
    throw new Error(getErrorMessage(legacyInserted.error, 'Impossible d’insérer les résultats de visibilité produit avec le schéma legacy.'));
  }
}

export type ProductVisibilityOnboardingStage =
  | 'no_products'
  | 'products_without_prompts'
  | 'ready_without_analysis'
  | 'analysis_without_results'
  | 'has_data';

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function round(value: number, digits = 1): number {
  const multiplier = Math.pow(10, digits);
  return Math.round(value * multiplier) / multiplier;
}

function dayFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttributes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).filter(Boolean);
  }
  return [];
}

function parseSources(value: unknown): Array<{ url: string; domain: string; source_type?: string }> {
  if (!Array.isArray(value)) return [];
  const mapped = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const url = String(source.url || '');
      const domain = String(source.domain || '');
      const sourceType = source.source_type ? String(source.source_type) : undefined;
      if (!url && !domain) return null;
      return {
        url: url || `https://${domain}`,
        domain: domain || '',
        source_type: sourceType,
      };
    })
    .filter(Boolean) as Array<{ url: string; domain: string; source_type?: string }>;

  const dedup = new Map<string, { url: string; domain: string; source_type?: string }>();
  for (const source of mapped) {
    const key = source.url || source.domain;
    dedup.set(key, source);
  }
  return Array.from(dedup.values());
}

function resolveDateBounds(window: ProductVisibilityDateWindow) {
  return {
    startIso: `${window.startDate}T00:00:00.000Z`,
    endIso: `${window.endDate}T23:59:59.999Z`,
  };
}

export function buildWindowFromDays(days = 30): ProductVisibilityDateWindow {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate,
  };
}

export function buildPreviousWindow(window: ProductVisibilityDateWindow): ProductVisibilityDateWindow {
  const start = new Date(`${window.startDate}T00:00:00Z`);
  const end = new Date(`${window.endDate}T00:00:00Z`);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);

  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);

  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };
}

export async function loadProductVisibilityContext(args: {
  supabase: any;
  projectId: string;
}): Promise<ProductVisibilityContext> {
  const [categoriesRes, productsRes, attributesRes, competitorsRes] = await Promise.all([
    args.supabase
      .from('product_categories')
      .select('id, name, description, business_intent')
      .eq('project_id', args.projectId)
      .order('name', { ascending: true }),
    args.supabase
      .from('products')
      .select('id, category_id, product_name, brand_name, is_owned_product, competitor_brand, attributes, target_keywords')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('product_attributes')
      .select('id, category_id, name')
      .eq('project_id', args.projectId)
      .order('name', { ascending: true }),
    args.supabase
      .from('competitors')
      .select('id, name, domain')
      .eq('project_id', args.projectId)
      .order('name', { ascending: true }),
  ]);

  return {
    categories: (categoriesRes.data || []) as ProductCategoryLite[],
    products: (productsRes.data || []) as ProductLite[],
    productAttributes: (attributesRes.data || []) as ProductAttributeLite[],
    competitors: (competitorsRes.data || []) as Array<{ id: string; name: string; domain: string | null }>,
  };
}

export async function parseAndPersistProductVisibilityResult(args: {
  supabase: any;
  projectId: string;
  brandName: string;
  runId: string | null;
  promptId: string;
  promptRunId: string;
  aiModel: string | null;
  promptText: string;
  rawAnswer: string;
  promptCategoryId?: string | null;
  promptBuyingIntent?: string | null;
  fallbackSentimentLabel?: 'positive' | 'neutral' | 'negative' | null;
  fallbackPosition?: number | null;
  citations?: CitationLite[];
  context?: ProductVisibilityContext;
}): Promise<ProductVisibilityParsedResult> {
  const context = args.context || (await loadProductVisibilityContext({
    supabase: args.supabase,
    projectId: args.projectId,
  }));

  const parsed = parseProductVisibilityResponse({
    rawAnswer: args.rawAnswer,
    promptText: args.promptText,
    brandName: args.brandName,
    categories: context.categories,
    products: context.products,
    productAttributes: context.productAttributes,
    citations: args.citations || [],
    competitorNames: context.competitors.map((competitor) => competitor.name),
    promptCategoryId: args.promptCategoryId || null,
    promptBuyingIntent: args.promptBuyingIntent || null,
    fallbackSentimentLabel: args.fallbackSentimentLabel || null,
    fallbackPosition: args.fallbackPosition || null,
  });

  const byProduct = new Map(context.products.map((product) => [product.id, product]));

  const basePayload = {
    project_id: args.projectId,
    run_id: args.runId,
    prompt_id: args.promptId,
    prompt_run_id: args.promptRunId,
    ai_model: args.aiModel,
    buying_intent: parsed.buying_intent,
    visibility_score: parsed.visibility_score,
    accuracy_score: parsed.accuracy_score,
    raw_answer: args.rawAnswer,
    analysis_json: parsed as unknown as Record<string, unknown>,
  };

  const mentionRows: Array<Record<string, unknown>> = [...parsed.owned_products_mentioned, ...parsed.competitor_products_mentioned].map((mention) => {
    const product = byProduct.get(mention.product_id);
    const categoryId = mention.category_id || parsed.category_id || product?.category_id || null;

    return {
      ...basePayload,
      product_id: mention.product_id,
      category_id: categoryId,
      detected_product_name: mention.product_name,
      detected_brand_name: mention.brand_name,
      // Confiance dérivée du score parser (0-1). Plus de valeur figée à 0.95.
      confidence_score: typeof parsed.accuracy_score === 'number'
        ? Math.max(0, Math.min(1, parsed.accuracy_score <= 1 ? parsed.accuracy_score : parsed.accuracy_score / 100))
        : null,
      rank_position: mention.rank_position,
      mention_count: 1,
      sentiment_score: mention.sentiment_score,
      attributes_detected: mention.attributes,
      sources_detected: parsed.sources_detected,
      is_owned_product: mention.is_owned_product,
    };
  });

  if (mentionRows.length === 0) {
    mentionRows.push({
      ...basePayload,
      product_id: null,
      category_id: parsed.category_id,
      detected_product_name: null,
      detected_brand_name: parsed.competitor_products_mentioned[0]?.brand_name || parsed.owned_products_mentioned[0]?.brand_name || null,
      confidence_score: 0,
      rank_position: args.fallbackPosition || null,
      mention_count: 0,
      sentiment_score: parsed.sentiment_score,
      attributes_detected: parsed.attributes_detected,
      sources_detected: parsed.sources_detected,
      is_owned_product: false,
    });
  }

  await args.supabase
    .from('product_visibility_results')
    .delete()
    .eq('project_id', args.projectId)
    .eq('prompt_run_id', args.promptRunId);

  await insertProductVisibilityRows({
    supabase: args.supabase,
    rows: mentionRows,
  });

  const recommendationsPayload = parsed.recommendations.map((recommendation) => ({
    project_id: args.projectId,
    run_id: args.runId,
    product_id: recommendation.related_product_id || null,
    category_id: recommendation.related_category_id || parsed.category_id,
    title: recommendation.title,
    description: recommendation.description,
    priority: recommendation.priority,
    expected_impact: recommendation.expected_impact,
    effort: recommendation.priority === 'high' ? 'medium' : 'low',
    source_reason: recommendation.source_reason,
    status: 'open',
  }));

  if (recommendationsPayload.length > 0) {
    const insertedRecommendations = await args.supabase
      .from('product_recommendations')
      .insert(recommendationsPayload);

    if (insertedRecommendations.error) {
      console.warn(
        '[product-visibility] recommendations insert failed',
        getErrorMessage(insertedRecommendations.error, 'Impossible d’insérer les recommandations produit.'),
      );
    }
  }

  return parsed;
}

export async function backfillProductVisibilityResultsForRun(args: {
  supabase: any;
  projectId: string;
  runId: string;
  brandName: string;
  context?: ProductVisibilityContext;
}) {
  const promptRunsRes = await args.supabase
    .from('prompt_runs')
    .select('id, prompt_id, ai_model, position_rank, sentiment_label')
    .eq('project_id', args.projectId)
    .eq('run_id', args.runId)
    .eq('status', 'success');

  if (promptRunsRes.error) {
    throw new Error(promptRunsRes.error.message || 'Impossible de lire les exécutions IA du run.');
  }

  const promptRuns = (promptRunsRes.data || []) as Array<{
    id: string;
    prompt_id: string | null;
    ai_model: string | null;
    position_rank: number | null;
    sentiment_label: 'positive' | 'neutral' | 'negative' | null;
  }>;

  const promptRunIds = promptRuns.map((row) => row.id);
  const promptIds = Array.from(new Set(promptRuns.map((row) => row.prompt_id).filter((id): id is string => Boolean(id))));

  if (promptRunIds.length === 0 || promptIds.length === 0) {
    return {
      prompt_runs: promptRuns.length,
      answers: 0,
      parsed: 0,
      failed: 0,
      skipped: promptRuns.length,
      errors: [],
    };
  }

  const [answersRes, initialPromptsRes] = await Promise.all([
    args.supabase
      .from('ai_answers')
      .select('prompt_run_id, raw_answer_text')
      .in('prompt_run_id', promptRunIds),
    args.supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, category_id, buying_intent, intent')
      .in('id', promptIds),
  ]);
  let promptsRes = initialPromptsRes;

  if (promptsRes.error && isMissingPromptFoundationColumnError(promptsRes.error)) {
    promptsRes = await args.supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, category_id, buying_intent')
      .in('id', promptIds);
  }

  if (answersRes.error) {
    throw new Error(answersRes.error.message || 'Impossible de lire les réponses IA du run.');
  }
  if (promptsRes.error) {
    throw new Error(promptsRes.error.message || 'Impossible de lire les requêtes IA du run.');
  }

  const answerByPromptRunId = new Map(
    ((answersRes.data || []) as Array<{ prompt_run_id: string; raw_answer_text: string | null }>)
      .filter((row) => row.raw_answer_text)
      .map((row) => [row.prompt_run_id, row.raw_answer_text as string]),
  );
  const promptById = new Map(
    ((promptsRes.data || []) as Array<{
      id: string;
      prompt_text: string;
      category_id: string | null;
      buying_intent: string | null;
      intent: string | null;
    }>).map((prompt) => [prompt.id, prompt]),
  );

  const context = args.context || await loadProductVisibilityContext({
    supabase: args.supabase,
    projectId: args.projectId,
  });

  let parsed = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const promptRun of promptRuns) {
    if (!promptRun.prompt_id) {
      skipped += 1;
      continue;
    }
    const prompt = promptById.get(promptRun.prompt_id);
    const rawAnswer = answerByPromptRunId.get(promptRun.id);
    if (!prompt || !rawAnswer) {
      skipped += 1;
      continue;
    }

    try {
      await parseAndPersistProductVisibilityResult({
        supabase: args.supabase,
        projectId: args.projectId,
        brandName: args.brandName,
        runId: args.runId,
        promptId: promptRun.prompt_id,
        promptRunId: promptRun.id,
        aiModel: promptRun.ai_model,
        promptText: prompt.prompt_text,
        rawAnswer,
        promptCategoryId: prompt.category_id,
        promptBuyingIntent: prompt.buying_intent || prompt.intent || null,
        fallbackSentimentLabel: promptRun.sentiment_label,
        fallbackPosition: promptRun.position_rank,
        context,
      });
      parsed += 1;
    } catch (error) {
      failed += 1;
      const message = getErrorMessage(error, 'Synchronisation impossible pour une réponse IA.');
      if (!errors.includes(message)) errors.push(message);
      console.warn('[product-visibility] result sync failed', {
        promptRunId: promptRun.id,
        promptId: promptRun.prompt_id,
        message,
      });
    }
  }

  return {
    prompt_runs: promptRuns.length,
    answers: answerByPromptRunId.size,
    parsed,
    failed,
    skipped,
    errors: errors.slice(0, 3),
  };
}

async function loadVisibilityDataset(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const bounds = resolveDateBounds(args.window);

  const [categoriesRes, productsRes, resultsRes, promptsRes, recommendationsRes, latestRunRes] = await Promise.all([
    args.supabase
      .from('product_categories')
      .select('id, name, description, business_intent, priority, status, created_at')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('products')
      .select('id, category_id, product_name, brand_name, product_url, sku, attributes, target_keywords, is_owned_product, competitor_brand, image_url, created_at, status')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('product_visibility_results')
      .select('*')
      .eq('project_id', args.projectId)
      .gte('created_at', bounds.startIso)
      .lte('created_at', bounds.endIso)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, topic_id, category_id, buying_intent, scope, intent, quality_status, lifecycle_status, prompt_origin, rationale, locale, topic_label, monitoring_frequency, is_active, status, created_at, updated_at')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: false }),
    args.supabase
      .from('product_recommendations')
      .select('id, run_id, product_id, category_id, title, description, priority, expected_impact, effort, source_reason, status, created_at')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: false }),
    args.supabase
      .from('monitoring_runs')
      .select('id, run_date, status, finished_at, created_at')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const categories = (categoriesRes.data || []) as Array<{
    id: string;
    name: string;
    description: string | null;
    business_intent: string | null;
    priority: string | null;
    status: string | null;
    created_at: string;
  }>;

  const products = (productsRes.data || []) as Array<{
    id: string;
    category_id: string | null;
    product_name: string;
    brand_name: string | null;
    product_url: string | null;
    sku: string | null;
    attributes: unknown;
    target_keywords: string[] | null;
    is_owned_product: boolean;
    competitor_brand: string | null;
    image_url: string | null;
    created_at: string;
    status: string | null;
  }>;

  const results = (resultsRes.data || []) as VisibilityRow[];
  const prompts = (promptsRes.data || []) as PromptRow[];
  const recommendations = (recommendationsRes.data || []) as RecommendationRow[];
  const latestRun = latestRunRes.data || null;

  return {
    categories,
    products,
    results,
    prompts,
    recommendations,
    latestRun,
  };
}

function groupResultsByDay(results: VisibilityRow[]) {
  const map = new Map<string, { owned: number; competitor: number; total: number }>();

  for (const row of results) {
    const day = dayFromIso(row.created_at);
    if (!day) continue;

    const mentionCount = Math.max(0, toNumber(row.mention_count, 0));
    const current = map.get(day) || { owned: 0, competitor: 0, total: 0 };

    current.total += mentionCount;
    if (row.is_owned_product) {
      current.owned += mentionCount;
    } else {
      current.competitor += mentionCount;
    }

    map.set(day, current);
  }

  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, values]) => ({
      day,
      owned_mentions: values.owned,
      competitor_mentions: values.competitor,
      total_mentions: values.total,
      visibility_score: values.total > 0 ? round((values.owned / values.total) * 100, 1) : 0,
    }));
}

function computeProductStats(args: {
  products: Array<{
    id: string;
    category_id: string | null;
    product_name: string;
    brand_name: string | null;
    is_owned_product: boolean;
    competitor_brand: string | null;
  }>;
  results: VisibilityRow[];
}) {
  const byProduct = new Map<string, {
    product_id: string;
    product_name: string;
    brand_name: string | null;
    category_id: string | null;
    is_owned_product: boolean;
    competitor_brand: string | null;
    mentions: number;
    position_total: number;
    position_count: number;
    sentiment_total: number;
    sentiment_count: number;
    attribute_counts: Map<string, number>;
    recent_mentions: number;
    previous_mentions: number;
  }>();

  for (const product of args.products) {
    byProduct.set(product.id, {
      product_id: product.id,
      product_name: product.product_name,
      brand_name: product.brand_name,
      category_id: product.category_id,
      is_owned_product: !!product.is_owned_product,
      competitor_brand: product.competitor_brand,
      mentions: 0,
      position_total: 0,
      position_count: 0,
      sentiment_total: 0,
      sentiment_count: 0,
      attribute_counts: new Map<string, number>(),
      recent_mentions: 0,
      previous_mentions: 0,
    });
  }

  const midpoint = Math.floor(args.results.length / 2);

  args.results.forEach((row, index) => {
    if (!row.product_id || !byProduct.has(row.product_id)) return;

    const stats = byProduct.get(row.product_id)!;
    const mentionCount = Math.max(0, toNumber(row.mention_count, 0));

    stats.mentions += mentionCount;

    if (index >= midpoint) {
      stats.recent_mentions += mentionCount;
    } else {
      stats.previous_mentions += mentionCount;
    }

    if (row.rank_position !== null && row.rank_position !== undefined) {
      stats.position_total += toNumber(row.rank_position);
      stats.position_count += 1;
    }

    if (row.sentiment_score !== null && row.sentiment_score !== undefined) {
      stats.sentiment_total += toNumber(row.sentiment_score);
      stats.sentiment_count += 1;
    }

    const attributes = parseAttributes(row.attributes_detected);
    for (const attribute of attributes) {
      const normalized = normalizeText(attribute);
      if (!normalized) continue;
      stats.attribute_counts.set(normalized, (stats.attribute_counts.get(normalized) || 0) + 1);
    }
  });

  // Total des mentions sur la fenêtre — sert de dénominateur à la part de voix per-produit.
  // Convention unifiée avec les formules de trend (l. ~676) et catégorie (l. ~927) :
  // visibility_score = part des mentions de CE produit sur l'ensemble des mentions produit observées.
  const totalMentionsForShare = Array.from(byProduct.values())
    .reduce((sum, stats) => sum + stats.mentions, 0);

  return Array.from(byProduct.values()).map((stats) => {
    const averagePosition = stats.position_count > 0
      ? round(stats.position_total / stats.position_count, 2)
      : null;

    const sentiment = stats.sentiment_count > 0
      ? round(stats.sentiment_total / stats.sentiment_count, 2)
      : 0;

    const topAttribute = Array.from(stats.attribute_counts.entries())
      .sort((left, right) => right[1] - left[1])[0]?.[0] || null;

    const trendDelta = stats.recent_mentions - stats.previous_mentions;
    const visibilityScore = totalMentionsForShare > 0
      ? round((stats.mentions / totalMentionsForShare) * 100, 1)
      : 0;

    return {
      ...stats,
      average_position: averagePosition,
      sentiment,
      top_attribute: topAttribute,
      trend_delta: trendDelta,
      visibility_score: visibilityScore,
    };
  });
}

function computeCategoryRows(args: {
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    business_intent: string | null;
    priority: string | null;
    status: string | null;
    created_at: string;
  }>;
  products: Array<{
    id: string;
    category_id: string | null;
    product_name: string;
    brand_name: string | null;
    is_owned_product: boolean;
    competitor_brand: string | null;
    status: string | null;
  }>;
  results: VisibilityRow[];
}) {
  const rows = new Map<string, {
    id: string;
    name: string;
    description: string | null;
    business_intent: string | null;
    priority: string | null;
    status: string | null;
    products_tracked: number;
    owned_products_count: number;
    competitor_products_count: number;
    owned_mentions: number;
    competitor_mentions: number;
    position_total: number;
    position_count: number;
    sentiment_total: number;
    sentiment_count: number;
    top_competitor_counts: Map<string, number>;
    attributes_counts: Map<string, number>;
    latest_run_at: string | null;
    recent_owned: number;
    previous_owned: number;
    recent_competitor: number;
    previous_competitor: number;
  }>();

  for (const category of args.categories) {
    rows.set(category.id, {
      id: category.id,
      name: category.name,
      description: category.description,
      business_intent: category.business_intent,
      priority: category.priority,
      status: category.status,
      products_tracked: 0,
      owned_products_count: 0,
      competitor_products_count: 0,
      owned_mentions: 0,
      competitor_mentions: 0,
      position_total: 0,
      position_count: 0,
      sentiment_total: 0,
      sentiment_count: 0,
      top_competitor_counts: new Map<string, number>(),
      attributes_counts: new Map<string, number>(),
      latest_run_at: null,
      recent_owned: 0,
      previous_owned: 0,
      recent_competitor: 0,
      previous_competitor: 0,
    });
  }

  const productsById = new Map(args.products.map((product) => [product.id, product]));

  for (const product of args.products) {
    if (!product.category_id) continue;
    if (!rows.has(product.category_id)) continue;

    const row = rows.get(product.category_id)!;
    row.products_tracked += 1;
    if (product.is_owned_product) {
      row.owned_products_count += 1;
    } else {
      row.competitor_products_count += 1;
    }
  }

  const midpoint = Math.floor(args.results.length / 2);

  args.results.forEach((result, index) => {
    const product = result.product_id ? productsById.get(result.product_id) : null;
    const categoryId = result.category_id || product?.category_id || null;
    if (!categoryId || !rows.has(categoryId)) return;

    const row = rows.get(categoryId)!;
    const mentionCount = Math.max(0, toNumber(result.mention_count, 0));

    if (result.is_owned_product) {
      row.owned_mentions += mentionCount;
      if (index >= midpoint) {
        row.recent_owned += mentionCount;
      } else {
        row.previous_owned += mentionCount;
      }
    } else {
      row.competitor_mentions += mentionCount;
      if (index >= midpoint) {
        row.recent_competitor += mentionCount;
      } else {
        row.previous_competitor += mentionCount;
      }

      const competitor = product?.competitor_brand || product?.brand_name || 'Competitor';
      row.top_competitor_counts.set(competitor, (row.top_competitor_counts.get(competitor) || 0) + mentionCount);
    }

    if (result.rank_position !== null && result.rank_position !== undefined) {
      row.position_total += toNumber(result.rank_position);
      row.position_count += 1;
    }

    if (result.sentiment_score !== null && result.sentiment_score !== undefined) {
      row.sentiment_total += toNumber(result.sentiment_score);
      row.sentiment_count += 1;
    }

    for (const attribute of parseAttributes(result.attributes_detected)) {
      const normalized = normalizeText(attribute);
      if (!normalized) continue;
      row.attributes_counts.set(normalized, (row.attributes_counts.get(normalized) || 0) + 1);
    }

    if (!row.latest_run_at || result.created_at > row.latest_run_at) {
      row.latest_run_at = result.created_at;
    }
  });

  return Array.from(rows.values()).map((row) => {
    const totalMentions = row.owned_mentions + row.competitor_mentions;
    const ownedVisibility = totalMentions > 0 ? round((row.owned_mentions / totalMentions) * 100, 1) : 0;
    const competitorVisibility = totalMentions > 0 ? round((row.competitor_mentions / totalMentions) * 100, 1) : 0;

    const topCompetitor = Array.from(row.top_competitor_counts.entries())
      .sort((left, right) => right[1] - left[1])[0]?.[0] || null;

    const topAttributes = Array.from(row.attributes_counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([attribute]) => attribute);

    const avgRanking = row.position_count > 0
      ? round(row.position_total / row.position_count, 2)
      : null;

    const sentiment = row.sentiment_count > 0
      ? round(row.sentiment_total / row.sentiment_count, 2)
      : 0;

    const opportunityScore = clamp(
      round((row.competitor_mentions + 1) / Math.max(row.owned_mentions + 1, 1) * 25 + (50 - ownedVisibility) * 0.5, 1),
      0,
      100,
    );

    const trendDelta = (row.recent_owned - row.previous_owned) - (row.recent_competitor - row.previous_competitor);

    return {
      category_id: row.id,
      category: row.name,
      description: row.description,
      business_intent: row.business_intent,
      priority: row.priority,
      status: row.status || 'active',
      products_tracked: row.products_tracked,
      owned_products_count: row.owned_products_count,
      competitor_products_count: row.competitor_products_count,
      owned_mentions: row.owned_mentions,
      competitor_mentions: row.competitor_mentions,
      owned_visibility: ownedVisibility,
      competitor_visibility: competitorVisibility,
      top_competitor: topCompetitor,
      top_attributes: topAttributes,
      avg_ranking: avgRanking,
      sentiment,
      opportunity_score: opportunityScore,
      trend_delta: trendDelta,
      last_run: row.latest_run_at,
    };
  });
}

function computeOpportunityProducts(args: {
  productStats: ReturnType<typeof computeProductStats>;
  categoriesById: Map<string, string>;
}) {
  return args.productStats
    .filter((product) => product.is_owned_product)
    .map((product) => {
      // visibility_score = part de voix (0-100). Un produit suivi avec 0% de part
      // est l'opportunité maximale. Pondération supplémentaire si position dégradée
      // ou sentiment négatif.
      const opportunityScore = clamp(
        round(
          (100 - product.visibility_score) * 0.7
          + Math.max(0, 8 - (product.average_position || 8)) * 4
          + Math.max(0, -product.sentiment * 8),
          1,
        ),
        0,
        100,
      );

      return {
        product_id: product.product_id,
        product_name: product.product_name,
        brand_name: product.brand_name,
        category: product.category_id ? args.categoriesById.get(product.category_id) || null : null,
        opportunity_score: opportunityScore,
        visibility_score: product.visibility_score,
        avg_position: product.average_position,
        mentions: product.mentions,
      };
    })
    .sort((left, right) => right.opportunity_score - left.opportunity_score);
}

export async function getProductVisibilityOverview(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);

  const categoriesById = new Map(dataset.categories.map((category) => [category.id, category.name]));
  const productStats = computeProductStats({
    products: dataset.products,
    results: dataset.results,
  });

  const categoryRows = computeCategoryRows({
    categories: dataset.categories,
    products: dataset.products,
    results: dataset.results,
  });

  const ownedMentions = dataset.results
    .filter((row) => row.is_owned_product)
    .reduce((sum, row) => sum + Math.max(0, toNumber(row.mention_count, 0)), 0);
  const competitorMentions = dataset.results
    .filter((row) => !row.is_owned_product)
    .reduce((sum, row) => sum + Math.max(0, toNumber(row.mention_count, 0)), 0);
  const mentionsTotal = ownedMentions + competitorMentions;

  const ownedWithRank = dataset.results.filter((row) => row.is_owned_product && row.rank_position !== null);
  const averageProductRanking = ownedWithRank.length > 0
    ? round(ownedWithRank.reduce((sum, row) => sum + toNumber(row.rank_position), 0) / ownedWithRank.length, 2)
    : null;

  const citationCoverageRows = dataset.results.filter((row) => parseSources(row.sources_detected).length > 0);
  const aiCitationCoverage = dataset.results.length > 0
    ? round((citationCoverageRows.length / dataset.results.length) * 100, 1)
    : null;

  const ownedSourceRows = dataset.results.filter((row) => row.is_owned_product);
  const ownedSourceCoverage = ownedSourceRows.length > 0
    ? round(
      (ownedSourceRows.filter((row) => parseSources(row.sources_detected).some((source) => source.source_type === 'owned')).length /
        ownedSourceRows.length) * 100,
      1,
    )
    : null;

  const visibilityScore = computeVisibilityScore({
    ownedMentions,
    competitorMentions,
    averageOwnedRanking: averageProductRanking,
    ownedSourceCoverage,
  });

  const accuracyRows = dataset.results.filter((row) => row.accuracy_score !== null && row.accuracy_score !== undefined);
  const productAccuracyScore = accuracyRows.length > 0
    ? round(
      (accuracyRows.reduce((sum, row) => sum + (toNumber(row.accuracy_score) <= 1 ? toNumber(row.accuracy_score) * 100 : toNumber(row.accuracy_score)), 0) /
        accuracyRows.length),
      1,
    )
    : null;

  const opportunityProducts = computeOpportunityProducts({
    productStats,
    categoriesById,
  });

  const trend = groupResultsByDay(dataset.results);

  const topProductsVisible = productStats
    .filter((product) => product.mentions > 0)
    .sort((left, right) => right.mentions - left.mentions)
    .slice(0, 8)
    .map((product) => ({
      product_id: product.product_id,
      product: product.product_name,
      brand: product.brand_name,
      owned: product.is_owned_product,
      mentions: product.mentions,
      visibility_score: product.visibility_score,
      avg_position: product.average_position,
      category: product.category_id ? categoriesById.get(product.category_id) || null : null,
    }));

  const absentCategories = categoryRows
    .filter((row) => row.owned_mentions === 0 && row.products_tracked > 0)
    .sort((left, right) => right.competitor_mentions - left.competitor_mentions)
    .slice(0, 8)
    .map((row) => ({
      category_id: row.category_id,
      category: row.category,
      competitor_mentions: row.competitor_mentions,
      products_tracked: row.products_tracked,
      opportunity_score: row.opportunity_score,
    }));

  const topCategoriesByVisibility = categoryRows
    .slice()
    .sort((left, right) => right.owned_visibility - left.owned_visibility)
    .slice(0, 8)
    .map((row) => ({
      category_id: row.category_id,
      category: row.category,
      owned_visibility: row.owned_visibility,
      competitor_visibility: row.competitor_visibility,
      mentions: row.owned_mentions + row.competitor_mentions,
    }));

  return {
    kpis: {
      product_visibility_score: visibilityScore,
      owned_product_mentions: ownedMentions,
      competitor_product_mentions: competitorMentions,
      average_product_ranking: averageProductRanking,
      ai_citation_coverage: aiCitationCoverage,
      high_opportunity_products: opportunityProducts.filter((item) => item.opportunity_score >= 70).length,
      product_accuracy_score: productAccuracyScore,
      last_run: dataset.latestRun?.finished_at || dataset.latestRun?.created_at || null,
    },
    charts: {
      visibility_trend: trend,
      owned_vs_competitor: {
        owned: ownedMentions,
        competitors: competitorMentions,
      },
      top_categories_by_visibility: topCategoriesByVisibility,
      top_products_visible: topProductsVisible,
      absent_categories: absentCategories,
    },
    table: categoryRows,
    opportunity_products: opportunityProducts.slice(0, 12),
  };
}

export async function getProductVisibilityCategories(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);

  const categoryRows = computeCategoryRows({
    categories: dataset.categories,
    products: dataset.products,
    results: dataset.results,
  });

  return {
    categories: categoryRows,
  };
}

export async function getProductVisibilityCategoryDetail(args: {
  supabase: any;
  projectId: string;
  categoryId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);
  const category = dataset.categories.find((item) => item.id === args.categoryId) || null;

  const categoryProducts = dataset.products.filter((product) => product.category_id === args.categoryId);
  const productsById = new Map(categoryProducts.map((product) => [product.id, product]));

  const categoryResults = dataset.results.filter((result) => {
    if (result.category_id === args.categoryId) return true;
    if (result.product_id && productsById.has(result.product_id)) return true;
    return false;
  });

  const promptMap = new Map(dataset.prompts.map((prompt) => [prompt.id, prompt]));
  const activePrompts = dataset.prompts
    .filter((prompt) => prompt.is_active !== false)
    .filter((prompt) => prompt.category_id === args.categoryId);

  const rankingRows = computeProductStats({
    products: categoryProducts.map((product) => ({
      id: product.id,
      category_id: product.category_id,
      product_name: product.product_name,
      brand_name: product.brand_name,
      is_owned_product: product.is_owned_product,
      competitor_brand: product.competitor_brand,
    })),
    results: categoryResults,
  })
    .sort((left, right) => {
      if (left.is_owned_product !== right.is_owned_product) {
        return left.is_owned_product ? -1 : 1;
      }
      return (left.average_position || 99) - (right.average_position || 99);
    })
    .map((row) => ({
      product_id: row.product_id,
      product: row.product_name,
      brand: row.brand_name,
      owned: row.is_owned_product,
      avg_rank: row.average_position,
      mentions: row.mentions,
      visibility_score: row.visibility_score,
      sentiment: row.sentiment,
      top_attribute: row.top_attribute,
      trend_delta: row.trend_delta,
    }));

  const attributeCounters = new Map<string, { total: number; owned: number; competitor: number }>();
  const sourceCounters = new Map<string, { domain: string; count: number; source_type: string }>();

  for (const result of categoryResults) {
    const mentionCount = Math.max(0, toNumber(result.mention_count, 0));

    for (const attribute of parseAttributes(result.attributes_detected)) {
      const key = normalizeText(attribute);
      if (!key) continue;
      const current = attributeCounters.get(key) || { total: 0, owned: 0, competitor: 0 };
      current.total += mentionCount;
      if (result.is_owned_product) {
        current.owned += mentionCount;
      } else {
        current.competitor += mentionCount;
      }
      attributeCounters.set(key, current);
    }

    for (const source of parseSources(result.sources_detected)) {
      const key = source.domain || source.url;
      const current = sourceCounters.get(key) || {
        domain: source.domain || source.url,
        count: 0,
        source_type: source.source_type || 'third_party',
      };
      current.count += mentionCount;
      sourceCounters.set(key, current);
    }
  }

  const topAttributes = Array.from(attributeCounters.entries())
    .sort((left, right) => right[1].total - left[1].total)
    .slice(0, 10)
    .map(([attribute, values]) => ({
      attribute,
      total_mentions: values.total,
      owned_mentions: values.owned,
      competitor_mentions: values.competitor,
    }));

  const topSources = Array.from(sourceCounters.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);

  const recommendations = dataset.recommendations
    .filter((item) => item.category_id === args.categoryId)
    .slice(0, 12);

  const matrixBuckets = {
    high_visibility_positive: 0,
    high_visibility_negative: 0,
    low_visibility_positive: 0,
    low_visibility_negative: 0,
  };

  for (const row of rankingRows) {
    const visibilityHigh = row.visibility_score >= 50;
    const sentimentPositive = row.sentiment >= 0;

    if (visibilityHigh && sentimentPositive) matrixBuckets.high_visibility_positive += 1;
    if (visibilityHigh && !sentimentPositive) matrixBuckets.high_visibility_negative += 1;
    if (!visibilityHigh && sentimentPositive) matrixBuckets.low_visibility_positive += 1;
    if (!visibilityHigh && !sentimentPositive) matrixBuckets.low_visibility_negative += 1;
  }

  const promptRows = activePrompts.map((prompt) => {
    const promptResults = categoryResults.filter((result) => result.prompt_id === prompt.id || promptMap.get(prompt.id)?.id === result.prompt_id);
    const ownedMentions = promptResults.filter((result) => result.is_owned_product).reduce((sum, result) => sum + Math.max(0, toNumber(result.mention_count, 0)), 0);
    const competitorMentions = promptResults.filter((result) => !result.is_owned_product).reduce((sum, result) => sum + Math.max(0, toNumber(result.mention_count, 0)), 0);

    return {
      id: prompt.id,
      prompt_text: prompt.prompt_text,
      buying_intent: prompt.buying_intent,
      monitoring_frequency: prompt.monitoring_frequency,
      status: prompt.status || (prompt.is_active ? 'active' : 'inactive'),
      results_count: promptResults.length,
      owned_visibility: ownedMentions,
      competitor_visibility: competitorMentions,
      last_run: promptResults[promptResults.length - 1]?.created_at || null,
    };
  });

  return {
    category,
    summary: {
      owned_products_tracked: categoryProducts.filter((product) => product.is_owned_product).length,
      competitor_products_detected: categoryProducts.filter((product) => !product.is_owned_product).length,
      total_mentions: categoryResults.reduce((sum, result) => sum + Math.max(0, toNumber(result.mention_count, 0)), 0),
      avg_sentiment: categoryResults.length > 0
        ? round(categoryResults.reduce((sum, result) => sum + toNumber(result.sentiment_score), 0) / categoryResults.length, 2)
        : 0,
    },
    prompts: promptRows,
    owned_products: rankingRows.filter((row) => row.owned),
    competitor_products: rankingRows.filter((row) => !row.owned),
    product_ranking: rankingRows,
    top_attributes: topAttributes,
    cited_sources: topSources,
    recommendations,
    matrix: matrixBuckets,
  };
}

export async function getProductVisibilityProducts(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);
  const categoriesById = new Map(dataset.categories.map((category) => [category.id, category.name]));

  const stats = computeProductStats({
    products: dataset.products.map((product) => ({
      id: product.id,
      category_id: product.category_id,
      product_name: product.product_name,
      brand_name: product.brand_name,
      is_owned_product: product.is_owned_product,
      competitor_brand: product.competitor_brand,
    })),
    results: dataset.results,
  });

  const rows = stats.map((stat) => ({
    product_id: stat.product_id,
    product: stat.product_name,
    brand: stat.brand_name,
    category: stat.category_id ? categoriesById.get(stat.category_id) || null : null,
    owned: stat.is_owned_product,
    visibility_score: stat.visibility_score,
    avg_position: stat.average_position,
    mentions: stat.mentions,
    sentiment: stat.sentiment,
    top_attribute: stat.top_attribute,
    trend: stat.trend_delta,
    actions: stat.is_owned_product
      ? stat.visibility_score < 45
        ? 'Optimize'
        : 'Monitor'
      : 'Track',
  }));

  return {
    products: rows,
  };
}

export async function getProductVisibilityProductDetail(args: {
  supabase: any;
  projectId: string;
  productId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);

  const product = dataset.products.find((item) => item.id === args.productId) || null;
  if (!product) {
    return {
      product: null,
      metrics: null,
      prompts: [],
      related_competitors: [],
      sources: [],
      attributes: [],
      ranking: null,
      recommendations: [],
    };
  }

  const categoryProducts = dataset.products.filter((item) => item.category_id === product.category_id);
  const categoryProductIds = new Set(categoryProducts.map((item) => item.id));
  const productResults = dataset.results.filter((result) => result.product_id === product.id);
  const categoryResults = dataset.results.filter((result) => result.product_id && categoryProductIds.has(result.product_id));

  const mentions = productResults.reduce((sum, result) => sum + Math.max(0, toNumber(result.mention_count, 0)), 0);
  const averagePositionRows = productResults.filter((result) => result.rank_position !== null);
  const avgPosition = averagePositionRows.length > 0
    ? round(averagePositionRows.reduce((sum, result) => sum + toNumber(result.rank_position), 0) / averagePositionRows.length, 2)
    : null;

  const sentimentRows = productResults.filter((result) => result.sentiment_score !== null);
  const sentiment = sentimentRows.length > 0
    ? round(sentimentRows.reduce((sum, result) => sum + toNumber(result.sentiment_score), 0) / sentimentRows.length, 2)
    : 0;

  const visibilityScore = clamp(mentions * 12 + (product.is_owned_product ? 10 : 0), 0, 100);

  const promptCounts = new Map<string, { prompt_text: string; count: number; last_seen: string | null }>();
  const promptMap = new Map(dataset.prompts.map((prompt) => [prompt.id, prompt]));

  for (const result of productResults) {
    const prompt = result.prompt_id ? promptMap.get(result.prompt_id) : null;
    if (!prompt) continue;

    const current = promptCounts.get(prompt.id) || {
      prompt_text: prompt.prompt_text,
      count: 0,
      last_seen: null as string | null,
    };

    current.count += Math.max(0, toNumber(result.mention_count, 0));
    if (!current.last_seen || result.created_at > current.last_seen) {
      current.last_seen = result.created_at;
    }

    promptCounts.set(prompt.id, current);
  }

  const prompts = Array.from(promptCounts.entries())
    .map(([id, data]) => ({
      prompt_id: id,
      prompt_text: data.prompt_text,
      mentions: data.count,
      last_seen: data.last_seen,
    }))
    .sort((left, right) => right.mentions - left.mentions)
    .slice(0, 12);

  const competitorMentions = new Map<string, number>();
  for (const result of categoryResults) {
    if (result.product_id === product.id) continue;
    const related = dataset.products.find((item) => item.id === result.product_id);
    if (!related) continue;

    const brand = related.competitor_brand || related.brand_name || related.product_name;
    competitorMentions.set(brand, (competitorMentions.get(brand) || 0) + Math.max(0, toNumber(result.mention_count, 0)));
  }

  const relatedCompetitors = Array.from(competitorMentions.entries())
    .map(([name, mentionCount]) => ({
      name,
      mentions: mentionCount,
    }))
    .sort((left, right) => right.mentions - left.mentions)
    .slice(0, 8);

  const sourceMap = new Map<string, { domain: string; url: string; count: number; source_type: string }>();
  for (const result of productResults) {
    for (const source of parseSources(result.sources_detected)) {
      const key = source.url || source.domain;
      const current = sourceMap.get(key) || {
        domain: source.domain,
        url: source.url,
        count: 0,
        source_type: source.source_type || 'third_party',
      };
      current.count += Math.max(0, toNumber(result.mention_count, 0));
      sourceMap.set(key, current);
    }
  }

  const sources = Array.from(sourceMap.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);

  const attributeMap = new Map<string, number>();
  for (const result of productResults) {
    for (const attribute of parseAttributes(result.attributes_detected)) {
      const key = normalizeText(attribute);
      if (!key) continue;
      attributeMap.set(key, (attributeMap.get(key) || 0) + Math.max(0, toNumber(result.mention_count, 0)));
    }
  }

  const attributes = Array.from(attributeMap.entries())
    .map(([attribute, count]) => ({ attribute, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);

  const categoryRanking = computeProductStats({
    products: categoryProducts.map((item) => ({
      id: item.id,
      category_id: item.category_id,
      product_name: item.product_name,
      brand_name: item.brand_name,
      is_owned_product: item.is_owned_product,
      competitor_brand: item.competitor_brand,
    })),
    results: categoryResults,
  }).sort((left, right) => (left.average_position || 99) - (right.average_position || 99));

  const rankIndex = categoryRanking.findIndex((item) => item.product_id === product.id);

  const ranking = {
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    total_products: categoryRanking.length,
    ahead: categoryRanking.slice(0, Math.max(0, rankIndex)).map((item) => ({
      product_id: item.product_id,
      product: item.product_name,
      brand: item.brand_name,
      avg_position: item.average_position,
      mentions: item.mentions,
    })),
    behind: rankIndex >= 0
      ? categoryRanking.slice(rankIndex + 1).map((item) => ({
          product_id: item.product_id,
          product: item.product_name,
          brand: item.brand_name,
          avg_position: item.average_position,
          mentions: item.mentions,
        }))
      : [],
    delta_vs_previous: productResults.length > 1
      ? round(toNumber(productResults[productResults.length - 1].rank_position, 0) - toNumber(productResults[0].rank_position, 0), 2)
      : 0,
  };

  const recommendations = dataset.recommendations
    .filter((item) => item.product_id === product.id || item.category_id === product.category_id)
    .slice(0, 10);

  return {
    product: {
      ...product,
      category_name: product.category_id
        ? dataset.categories.find((category) => category.id === product.category_id)?.name || null
        : null,
    },
    metrics: {
      visibility_score: visibilityScore,
      avg_position: avgPosition,
      mentions,
      sentiment,
    },
    prompts,
    related_competitors: relatedCompetitors,
    sources,
    attributes,
    ranking,
    recommendations,
  };
}

export async function getProductVisibilityAttributes(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);
  const previousWindow = buildPreviousWindow(args.window);
  const previousBounds = resolveDateBounds(previousWindow);

  const previousResultsRes = await args.supabase
    .from('product_visibility_results')
    .select('attributes_detected, mention_count, is_owned_product')
    .eq('project_id', args.projectId)
    .gte('created_at', previousBounds.startIso)
    .lte('created_at', previousBounds.endIso);

  const previousResults = (previousResultsRes.data || []) as Array<{
    attributes_detected: unknown;
    mention_count: number | null;
    is_owned_product: boolean | null;
  }>;

  const productsById = new Map(dataset.products.map((product) => [product.id, product]));
  const categoriesById = new Map(dataset.categories.map((category) => [category.id, category.name]));

  const attributeRows = new Map<string, {
    attribute: string;
    category_id: string | null;
    category_name: string | null;
    owned_mentions: number;
    competitor_mentions: number;
    sentiment_total: number;
    sentiment_count: number;
    frequency: number;
    product_mentions: Map<string, number>;
  }>();

  for (const result of dataset.results) {
    const mentionCount = Math.max(0, toNumber(result.mention_count, 0));
    const product = result.product_id ? productsById.get(result.product_id) : null;
    const categoryId = result.category_id || product?.category_id || null;
    const categoryName = categoryId ? categoriesById.get(categoryId) || null : null;

    for (const attribute of parseAttributes(result.attributes_detected)) {
      const key = normalizeText(attribute);
      if (!key) continue;

      const row = attributeRows.get(key) || {
        attribute: key,
        category_id: categoryId,
        category_name: categoryName,
        owned_mentions: 0,
        competitor_mentions: 0,
        sentiment_total: 0,
        sentiment_count: 0,
        frequency: 0,
        product_mentions: new Map<string, number>(),
      };

      row.frequency += mentionCount;
      if (result.is_owned_product) {
        row.owned_mentions += mentionCount;
      } else {
        row.competitor_mentions += mentionCount;
      }

      if (result.sentiment_score !== null && result.sentiment_score !== undefined) {
        row.sentiment_total += toNumber(result.sentiment_score);
        row.sentiment_count += 1;
      }

      if (result.product_id) {
        const productName = product?.product_name || result.product_id;
        row.product_mentions.set(productName, (row.product_mentions.get(productName) || 0) + mentionCount);
      }

      attributeRows.set(key, row);
    }
  }

  const previousAttributeCounts = new Map<string, { total: number; owned: number; competitor: number }>();
  for (const result of previousResults) {
    const mentionCount = Math.max(0, toNumber(result.mention_count, 0));
    for (const attribute of parseAttributes(result.attributes_detected)) {
      const key = normalizeText(attribute);
      if (!key) continue;
      const current = previousAttributeCounts.get(key) || { total: 0, owned: 0, competitor: 0 };
      current.total += mentionCount;
      if (result.is_owned_product) {
        current.owned += mentionCount;
      } else {
        current.competitor += mentionCount;
      }
      previousAttributeCounts.set(key, current);
    }
  }

  const rows = Array.from(attributeRows.values()).map((row) => {
    const total = row.owned_mentions + row.competitor_mentions;
    const ownedVisibility = total > 0 ? round((row.owned_mentions / total) * 100, 1) : 0;
    const competitorVisibility = total > 0 ? round((row.competitor_mentions / total) * 100, 1) : 0;

    const topProduct = Array.from(row.product_mentions.entries())
      .sort((left, right) => right[1] - left[1])[0]?.[0] || null;

    const topProductBrand = dataset.products.find((product) => product.product_name === topProduct)?.brand_name || null;

    const averageSentiment = row.sentiment_count > 0
      ? round(row.sentiment_total / row.sentiment_count, 2)
      : 0;

    const previous = previousAttributeCounts.get(row.attribute);
    const previousTotal = previous ? previous.total : 0;
    const delta = row.frequency - previousTotal;

    const opportunity = clamp(round((competitorVisibility - ownedVisibility) * 0.8 + (delta < 0 ? 10 : 0), 1), 0, 100);

    return {
      attribute: row.attribute,
      category_id: row.category_id,
      category: row.category_name,
      product_leader: topProduct,
      brand_leader: topProductBrand,
      owned_visibility: ownedVisibility,
      competitor_visibility: competitorVisibility,
      sentiment_avg: averageSentiment,
      citation_frequency: row.frequency,
      opportunity,
      delta,
      top_products: Array.from(row.product_mentions.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4)
        .map(([product, score]) => ({ product, score })),
    };
  });

  const itemsByAttributeShare = rows
    .map((row) => {
      const total = row.owned_visibility + row.competitor_visibility;
      const share = total > 0 ? round((row.owned_visibility / total) * 100, 1) : 0;
      return {
        attribute: row.attribute,
        top_products: row.top_products,
        share,
        delta: row.delta,
      };
    })
    .sort((left, right) => right.share - left.share)
    .slice(0, 20);

  return {
    attributes: rows.sort((left, right) => right.citation_frequency - left.citation_frequency),
    items_by_attribute_share: itemsByAttributeShare,
  };
}

export async function getProductVisibilityRecommendations(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);

  const categoriesById = new Map(dataset.categories.map((category) => [category.id, category.name]));
  const productsById = new Map(dataset.products.map((product) => [product.id, product]));

  const rows = dataset.recommendations.map((recommendation) => ({
    id: recommendation.id,
    title: recommendation.title,
    description: recommendation.description,
    related_category: recommendation.category_id ? categoriesById.get(recommendation.category_id) || null : null,
    related_product: recommendation.product_id ? productsById.get(recommendation.product_id)?.product_name || null : null,
    priority: recommendation.priority,
    expected_impact: recommendation.expected_impact,
    effort: recommendation.effort,
    source_reason: recommendation.source_reason,
    status: recommendation.status,
    created_at: recommendation.created_at,
  }));

  return {
    recommendations: rows,
  };
}

function parseProductAttributeValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const values = new Set<string>();
  for (const [key, raw] of Object.entries(record)) {
    if (Array.isArray(raw)) {
      raw.map((item) => String(item).trim()).filter(Boolean).forEach((item) => values.add(item));
      continue;
    }
    if (typeof raw === 'string' && raw.trim()) {
      values.add(raw.trim());
      continue;
    }
    if (key && key !== 'description') values.add(key);
  }

  return Array.from(values);
}

function isMissingProductFoundationColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string; details?: string };
  const message = `${record.message || ''} ${record.details || ''}`.toLowerCase();

  return record.code === '42703'
    || message.includes('products.description')
    || message.includes('products.use_case')
    || message.includes('products.target_customer')
    || message.includes("'description' column")
    || message.includes("'use_case' column")
    || message.includes("'target_customer' column");
}

function isMissingPromptFoundationColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string; details?: string };
  const message = `${record.message || ''} ${record.details || ''}`.toLowerCase();

  return record.code === '42703'
    || message.includes('monitoring_prompts.scope')
    || message.includes('monitoring_prompts.intent')
    || message.includes('monitoring_prompts.quality_status')
    || message.includes('monitoring_prompts.lifecycle_status')
    || message.includes('monitoring_prompts.prompt_origin')
    || message.includes('monitoring_prompts.rationale')
    || message.includes('monitoring_prompts.locale')
    || message.includes("'scope' column")
    || message.includes("'quality_status' column")
    || message.includes("'lifecycle_status' column")
    || message.includes("'prompt_origin' column");
}

function lifecycleFromQuality(qualityStatus: GeneratedProductPrompt['qualityStatus']): PromptLifecycleStatus {
  return qualityStatus === 'valid' ? 'validated' : 'draft';
}

function lifecycleForGeneratedPrompt(args: {
  qualityStatus: GeneratedProductPrompt['qualityStatus'];
  activateValid?: boolean;
}): PromptLifecycleStatus {
  if (args.activateValid && args.qualityStatus === 'valid') return 'active';
  return lifecycleFromQuality(args.qualityStatus);
}

function mapGeneratedPromptForResponse(args: {
  prompt: GeneratedProductPrompt;
  id: string | null;
  productId: string;
  categoryId: string | null;
  lifecycleStatus: PromptLifecycleStatus;
  persisted: boolean;
  reused: boolean;
}) {
  return {
    id: args.id,
    prompt_text: args.prompt.text,
    text: args.prompt.text,
    product_id: args.productId,
    category_id: args.categoryId,
    scope: args.prompt.scope,
    intent: args.prompt.intent,
    buying_intent: args.prompt.intent,
    rationale: args.prompt.rationale,
    quality_status: args.prompt.qualityStatus,
    qualityStatus: args.prompt.qualityStatus,
    lifecycle_status: args.lifecycleStatus,
    lifecycleStatus: args.lifecycleStatus,
    prompt_origin: 'product_visibility',
    monitoring_frequency: 'daily',
    target_product_ids: [args.productId],
    persisted: args.persisted,
    reused: args.reused,
  };
}

export async function generateProductVisibilityPromptsForProduct(args: {
  supabase: any;
  projectId: string;
  productId: string;
  persist?: boolean;
  activateValid?: boolean;
  locale?: 'fr-FR' | 'en-US';
  engines?: Array<{ engine: string; model?: string | null }>;
}) {
  let productResult = await args.supabase
    .from('products')
    .select('id, category_id, product_name, brand_name, product_url, attributes, target_keywords, description, use_case, target_customer, category:product_categories(name)')
    .eq('project_id', args.projectId)
    .eq('id', args.productId)
    .maybeSingle();

  if (productResult.error && isMissingProductFoundationColumnError(productResult.error)) {
    productResult = await args.supabase
      .from('products')
      .select('id, category_id, product_name, brand_name, product_url, attributes, target_keywords, category:product_categories(name)')
      .eq('project_id', args.projectId)
      .eq('id', args.productId)
      .maybeSingle();
  }

  const product = productResult.data
    ? {
        ...productResult.data,
        description: productResult.data.description || null,
        use_case: productResult.data.use_case || null,
        target_customer: productResult.data.target_customer || null,
      }
    : null;

  if (productResult.error) throw new Error(productResult.error.message);
  if (!product) throw new Error('Produit introuvable.');

  const { data: project } = await args.supabase
    .from('projects')
    .select('id, name')
    .eq('id', args.projectId)
    .maybeSingle();

  const [competitorsRes, competitorProductsRes] = await Promise.all([
    args.supabase
      .from('competitors')
      .select('id, name')
      .eq('project_id', args.projectId)
      .order('created_at', { ascending: true }),
    args.supabase
      .from('products')
      .select('brand_name, competitor_brand, product_name')
      .eq('project_id', args.projectId)
      .eq('is_owned_product', false)
      .limit(10),
  ]);

  const competitors = new Map<string, { id: string | null; name: string }>();
  for (const row of competitorsRes.data || []) {
    const name = String(row.name || '').trim();
    if (name) competitors.set(normalizeText(name), { id: row.id, name });
  }
  for (const row of competitorProductsRes.data || []) {
    const name = String(row.competitor_brand || row.brand_name || row.product_name || '').trim();
    if (name && !competitors.has(normalizeText(name))) {
      competitors.set(normalizeText(name), { id: null, name });
    }
  }

  const attributes = Array.from(new Set([
    ...parseProductAttributeValues(product.attributes),
    ...((product.target_keywords || []) as string[]),
  ])).filter(Boolean);
  const productAttributes = product.attributes && typeof product.attributes === 'object'
    ? product.attributes as Record<string, unknown>
    : {};
  const categoryName = Array.isArray(product.category)
    ? product.category[0]?.name || ''
    : product.category?.name || '';
  const description = product.description || (typeof productAttributes.description === 'string' ? productAttributes.description : undefined);

  const generated = generateProductPrompts({
    productName: product.product_name,
    category: categoryName || undefined,
    description: description || undefined,
    useCase: product.use_case || undefined,
    targetCustomer: product.target_customer || undefined,
    attributes,
    brandName: product.brand_name || project?.name || undefined,
    competitors: Array.from(competitors.values()).map((competitor) => competitor.name),
    locale: args.locale || 'fr-FR',
  });

  if (!args.persist) {
    return {
      product,
      suggestions: generated.map((prompt) => mapGeneratedPromptForResponse({
        prompt,
        id: null,
        productId: product.id,
        categoryId: product.category_id,
        lifecycleStatus: lifecycleForGeneratedPrompt({
          qualityStatus: prompt.qualityStatus,
          activateValid: args.activateValid,
        }),
        persisted: false,
        reused: false,
      })),
      counts: {
        suggestions: generated.length,
        persisted: 0,
        reused: 0,
      },
    };
  }

  const [existingPromptsRes, existingRelationsRes] = await Promise.all([
    args.supabase
      .from('monitoring_prompts')
      .select('id, prompt_text')
      .eq('project_id', args.projectId),
    args.supabase
      .from('monitoring_prompt_products')
      .select('prompt_id')
      .eq('project_id', args.projectId)
      .eq('product_id', product.id),
  ]);

  const linkedPromptIds = new Set((existingRelationsRes.data || []).map((row: { prompt_id: string }) => row.prompt_id));
  const existingPromptByText = new Map(
    ((existingPromptsRes.data || []) as Array<{ id: string; prompt_text: string }>).map((prompt) => [normalizeText(prompt.prompt_text), prompt.id]),
  );

  let persisted = 0;
  let reused = 0;
  const suggestions = [];

  for (const prompt of generated) {
    const normalized = normalizeText(prompt.text);
    const lifecycleStatus = lifecycleForGeneratedPrompt({
      qualityStatus: prompt.qualityStatus,
      activateValid: args.activateValid,
    });
    const shouldActivate = lifecycleStatus === 'active';
    let promptId = existingPromptByText.get(normalized) || null;
    let wasReused = false;

    if (!promptId) {
      const legacyPromptPayload = {
        project_id: args.projectId,
        prompt_text: prompt.text,
        source: 'generated',
        category_id: product.category_id,
        buying_intent: prompt.intent,
        topic_label: categoryName || null,
        monitoring_frequency: 'daily',
        is_active: shouldActivate,
        status: shouldActivate ? 'active' : 'paused',
      };
      const foundationPromptPayload = {
        ...legacyPromptPayload,
        scope: prompt.scope,
        intent: prompt.intent,
        quality_status: prompt.qualityStatus,
        lifecycle_status: lifecycleStatus,
        prompt_origin: 'product_visibility',
        rationale: prompt.rationale,
        locale: args.locale || 'fr-FR',
      };

      let inserted = await args.supabase
        .from('monitoring_prompts')
        .insert(foundationPromptPayload)
        .select('id')
        .single();

      if (inserted.error && isMissingPromptFoundationColumnError(inserted.error)) {
        inserted = await args.supabase
          .from('monitoring_prompts')
          .insert(legacyPromptPayload)
          .select('id')
          .single();
      }

      if (inserted.error || !inserted.data?.id) {
        throw new Error(inserted.error?.message || 'Impossible de créer une requête IA produit.');
      }

      const createdPromptId = inserted.data.id as string;
      promptId = createdPromptId;
      existingPromptByText.set(normalized, createdPromptId);
      persisted += 1;

      await args.supabase
        .from('prompt_versions')
        .insert({
          prompt_id: promptId,
          version_number: 1,
          prompt_text: prompt.text,
          is_active: true,
        });
    } else {
      wasReused = true;
      reused += 1;

      if (shouldActivate) {
        const updated = await args.supabase
          .from('monitoring_prompts')
          .update({
            scope: prompt.scope,
            intent: prompt.intent,
            quality_status: prompt.qualityStatus,
            lifecycle_status: lifecycleStatus,
            rationale: prompt.rationale,
            locale: args.locale || 'fr-FR',
            monitoring_frequency: 'daily',
            is_active: true,
            status: 'active',
          })
          .eq('id', promptId);

        if (updated.error && isMissingPromptFoundationColumnError(updated.error)) {
          await args.supabase
            .from('monitoring_prompts')
            .update({
              monitoring_frequency: 'daily',
              is_active: true,
              status: 'active',
            })
            .eq('id', promptId);
        }
      }
    }

    if (promptId && !linkedPromptIds.has(promptId)) {
      await args.supabase
        .from('monitoring_prompt_products')
        .upsert({
          project_id: args.projectId,
          prompt_id: promptId,
          product_id: product.id,
          is_primary: true,
        }, {
          onConflict: 'prompt_id,product_id',
        });
      linkedPromptIds.add(promptId);
    }

    const matchedCompetitors = Array.from(competitors.values()).filter((competitor) =>
      competitor.id && normalizeText(prompt.text).includes(normalizeText(competitor.name))
    );
    if (promptId && matchedCompetitors.length > 0) {
      await args.supabase
        .from('monitoring_prompt_competitors')
        .upsert(
          matchedCompetitors.map((competitor) => ({
            prompt_id: promptId,
            competitor_id: competitor.id,
          })),
          { onConflict: 'prompt_id,competitor_id' },
        );
    }

    const engineRows = (args.engines || [])
      .filter((engine) => engine.engine)
      .map((engine) => ({
        prompt_id: promptId,
        engine: engine.engine,
        model: engine.model || null,
        is_active: true,
      }));
    if (promptId && engineRows.length > 0) {
      await args.supabase
        .from('monitoring_prompt_engines')
        .upsert(engineRows, { onConflict: 'prompt_id,engine' });
    }

    suggestions.push(mapGeneratedPromptForResponse({
      prompt,
      id: promptId,
      productId: product.id,
      categoryId: product.category_id,
      lifecycleStatus,
      persisted: !wasReused,
      reused: wasReused,
    }));
  }

  return {
    product,
    suggestions,
    counts: {
      suggestions: generated.length,
      persisted,
      reused,
    },
  };
}

export async function generateProductVisibilityPrompts(args: {
  supabase: any;
  projectId: string;
  productId?: string | null;
  persist?: boolean;
  activateValid?: boolean;
  locale?: 'fr-FR' | 'en-US';
  engines?: Array<{ engine: string; model?: string | null }>;
}) {
  if (args.productId) {
    return generateProductVisibilityPromptsForProduct({
      supabase: args.supabase,
      projectId: args.projectId,
      productId: args.productId,
      persist: args.persist,
      activateValid: args.activateValid,
      locale: args.locale,
      engines: args.engines,
    });
  }

  const context = await loadProductVisibilityContext({
    supabase: args.supabase,
    projectId: args.projectId,
  });

  const ownedProducts = context.products.filter((product) => product.is_owned_product !== false);
  const targetProducts = ownedProducts.length > 0 ? ownedProducts : context.products;

  if (targetProducts.length > 0) {
    const allSuggestions: ReturnType<typeof mapGeneratedPromptForResponse>[] = [];
    let persisted = 0;
    let reused = 0;

    for (const product of targetProducts) {
      const generated = await generateProductVisibilityPromptsForProduct({
        supabase: args.supabase,
        projectId: args.projectId,
        productId: product.id,
        persist: args.persist,
        activateValid: args.activateValid,
        locale: args.locale,
        engines: args.engines,
      });

      allSuggestions.push(...generated.suggestions);
      persisted += generated.counts.persisted;
      reused += generated.counts.reused;
    }

    return {
      suggestions: allSuggestions,
      counts: {
        products: targetProducts.length,
        suggestions: allSuggestions.length,
        persisted,
        reused,
        products_used: targetProducts.length,
      },
    };
  }

  const categoriesById = new Map(context.categories.map((category) => [category.id, category]));
  const productsByCategory = new Map<string, ProductLite[]>();

  for (const product of context.products) {
    if (!product.category_id) continue;
    const list = productsByCategory.get(product.category_id) || [];
    list.push(product);
    productsByCategory.set(product.category_id, list);
  }

  const suggestions: Array<{
    prompt_text: string;
    category_id: string;
    buying_intent: 'discovery' | 'comparison' | 'decision' | 'attribute-based';
    topic_label: string;
    monitoring_frequency: string;
    target_product_ids: string[];
  }> = [];

  for (const category of context.categories) {
    const categoryProducts = productsByCategory.get(category.id) || [];
    const ownedProducts = categoryProducts.filter((product) => product.is_owned_product);
    const competitorProducts = categoryProducts.filter((product) => !product.is_owned_product);

    const ownedProduct = ownedProducts[0];
    const competitorProduct = competitorProducts[0];

    const categoryName = category.name;
    const ownedName = ownedProduct?.product_name || `produit ${categoryName}`;
    const competitorName = competitorProduct?.product_name || `alternative ${categoryName}`;
    const ownedBrand = ownedProduct?.brand_name || 'ma marque';
    const competitorBrand = competitorProduct?.brand_name || competitorProduct?.competitor_brand || 'marque concurrente';

    const promptTemplates = [
      {
        prompt_text: `Quels sont les meilleurs ${categoryName} pour une entreprise ?`,
        buying_intent: 'discovery' as const,
      },
      {
        prompt_text: `Comparer ${ownedBrand} et ${competitorBrand} pour la catégorie ${categoryName}.`,
        buying_intent: 'comparison' as const,
      },
      {
        prompt_text: `Où acheter ${ownedName} avec livraison rapide ?`,
        buying_intent: 'decision' as const,
      },
      {
        prompt_text: `Quel ${categoryName} choisir avec des exigences de robustesse, garantie et maintenance ?`,
        buying_intent: 'attribute-based' as const,
      },
      {
        prompt_text: `Quelle alternative à ${competitorName} recommander pour un acheteur B2B ?`,
        buying_intent: 'comparison' as const,
      },
    ];

    for (const template of promptTemplates) {
      suggestions.push({
        prompt_text: template.prompt_text,
        category_id: category.id,
        buying_intent: template.buying_intent,
        topic_label: categoryName,
        monitoring_frequency: 'daily',
        target_product_ids: categoryProducts.slice(0, 3).map((product) => product.id),
      });
    }
  }

  if (args.persist && suggestions.length > 0) {
    const existingPromptsRes = await args.supabase
      .from('monitoring_prompts')
      .select('id, prompt_text')
      .eq('project_id', args.projectId);

    const existingPrompts = new Map(
      ((existingPromptsRes.data || []) as Array<{ id: string; prompt_text: string }>).map((prompt) => [normalizeText(prompt.prompt_text), prompt.id]),
    );

    for (const suggestion of suggestions) {
      const normalized = normalizeText(suggestion.prompt_text);
      let promptId = existingPrompts.get(normalized) || null;

      if (!promptId) {
        const inserted = await args.supabase
          .from('monitoring_prompts')
          .insert({
            project_id: args.projectId,
            prompt_text: suggestion.prompt_text,
            source: 'template',
            category_id: suggestion.category_id,
            buying_intent: suggestion.buying_intent,
            topic_label: suggestion.topic_label,
            monitoring_frequency: suggestion.monitoring_frequency,
            is_active: true,
            status: 'active',
          })
          .select('id')
          .single();

        promptId = inserted.data?.id || null;
        if (promptId) {
          existingPrompts.set(normalized, promptId);
        }
      }

      if (!promptId) continue;

      const relations = suggestion.target_product_ids.map((productId) => ({
        project_id: args.projectId,
        prompt_id: promptId,
        product_id: productId,
        is_primary: false,
      }));

      if (relations.length > 0) {
        await args.supabase
          .from('monitoring_prompt_products')
          .upsert(relations, {
            onConflict: 'prompt_id,product_id',
          });
      }
    }
  }

  return {
    suggestions,
    counts: {
      categories: context.categories.length,
      suggestions: suggestions.length,
      products_used: context.products.length,
    },
  };
}

export async function generateProductVisibilityRecommendations(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
  persist?: boolean;
}) {
  const [overview, categories, products, attributes] = await Promise.all([
    getProductVisibilityOverview({
      supabase: args.supabase,
      projectId: args.projectId,
      window: args.window,
    }),
    getProductVisibilityCategories({
      supabase: args.supabase,
      projectId: args.projectId,
      window: args.window,
    }),
    getProductVisibilityProducts({
      supabase: args.supabase,
      projectId: args.projectId,
      window: args.window,
    }),
    getProductVisibilityAttributes({
      supabase: args.supabase,
      projectId: args.projectId,
      window: args.window,
    }),
  ]);

  const generated: Array<{
    title: string;
    description: string;
    related_category: string | null;
    related_product: string | null;
    related_category_id: string | null;
    related_product_id: string | null;
    priority: 'high' | 'medium' | 'low';
    expected_impact: string;
    effort: string;
    source_reason: string;
    status: string;
  }> = [];

  const topCategoryOpportunities = categories.categories
    .filter((category) => category.opportunity_score >= 65)
    .sort((left, right) => right.opportunity_score - left.opportunity_score)
    .slice(0, 3);

  for (const category of topCategoryOpportunities) {
    generated.push({
      title: `Créer une page catégorie orientée IA : ${category.category}`,
      description: 'Développer un contenu comparatif et transactionnel qui explicite les attributs décisionnels et cas d’usage B2B de la catégorie.',
      related_category: category.category,
      related_product: null,
      related_category_id: category.category_id,
      related_product_id: null,
      priority: 'high',
      expected_impact: 'Hausse de la visibilité de vos produits sur les requêtes de découverte et de comparaison.',
      effort: 'medium',
      source_reason: 'auto-generated: opportunité catégorie élevée',
      status: 'open',
    });
  }

  const lowVisibilityOwnedProducts = products.products
    .filter((product) => product.owned)
    .filter((product) => product.visibility_score < 45)
    .sort((left, right) => left.visibility_score - right.visibility_score)
    .slice(0, 3);

  for (const product of lowVisibilityOwnedProducts) {
    generated.push({
      title: `Optimiser la fiche produit ${product.product}`,
      description: 'Ajouter attributs, FAQ et preuves de conformité pour augmenter les signaux exploités par les IA sur les requêtes de décision.',
      related_category: product.category,
      related_product: product.product,
      related_category_id: categories.categories.find((category) => category.category === product.category)?.category_id || null,
      related_product_id: product.product_id,
      priority: 'high',
      expected_impact: 'Améliorer la présence du produit dans les classements IA.',
      effort: 'low',
      source_reason: 'auto-generated: visibilité produit faible',
      status: 'open',
    });
  }

  const attributeGaps = attributes.attributes
    .filter((attribute) => attribute.competitor_visibility - attribute.owned_visibility >= 30)
    .sort((left, right) => right.opportunity - left.opportunity)
    .slice(0, 3);

  for (const attribute of attributeGaps) {
    generated.push({
      title: `Renforcer l’attribut ${attribute.attribute}`,
      description: `L’attribut ${attribute.attribute} est dominé par les concurrents. L’enrichir sur les fiches produits et pages catégorie pour corriger l’écart de visibilité.`,
      related_category: attribute.category,
      related_product: attribute.product_leader,
      related_category_id: attribute.category_id,
      related_product_id: null,
      priority: 'medium',
      expected_impact: 'Réduction de l’écart concurrentiel sur les requêtes par attribut.',
      effort: 'medium',
      source_reason: 'auto-generated: écart sur attribut',
      status: 'open',
    });
  }

  if (overview.kpis.ai_citation_coverage !== null && overview.kpis.ai_citation_coverage < 40) {
    generated.push({
      title: 'Améliorer les données structurées produit',
      description: 'Mettre à jour schema.org Product/Offer, liens canoniques et balisage FAQ pour augmenter la citation de vos sources.',
      related_category: null,
      related_product: null,
      related_category_id: null,
      related_product_id: null,
      priority: 'high',
      expected_impact: 'Hausse de la couverture de citations IA.',
      effort: 'medium',
      source_reason: 'auto-generated: couverture des sources faible',
      status: 'open',
    });
  }

  if (overview.kpis.product_accuracy_score !== null && overview.kpis.product_accuracy_score < 70) {
    generated.push({
      title: 'Corriger les informations produit inexactes',
      description: 'Vérifier prix, disponibilité, capacités et garanties présentes sur les pages citées pour réduire les erreurs des IA.',
      related_category: null,
      related_product: null,
      related_category_id: null,
      related_product_id: null,
      priority: 'medium',
      expected_impact: 'Améliorer la précision des recommandations IA.',
      effort: 'low',
      source_reason: 'auto-generated: fiabilité produit faible',
      status: 'open',
    });
  }

  const deduplicated = Array.from(
    new Map(generated.map((recommendation) => [normalizeText(recommendation.title), recommendation])).values(),
  ).slice(0, 12);

  if (args.persist) {
    await args.supabase
      .from('product_recommendations')
      .delete()
      .eq('project_id', args.projectId)
      .ilike('source_reason', 'auto-generated:%');

    if (deduplicated.length > 0) {
      await args.supabase
        .from('product_recommendations')
        .insert(
          deduplicated.map((recommendation) => ({
            project_id: args.projectId,
            title: recommendation.title,
            description: recommendation.description,
            category_id: recommendation.related_category_id,
            product_id: recommendation.related_product_id,
            priority: recommendation.priority,
            expected_impact: recommendation.expected_impact,
            effort: recommendation.effort,
            source_reason: recommendation.source_reason,
            status: recommendation.status,
          })),
        );
    }
  }

  return {
    recommendations: deduplicated,
  };
}

export async function getProductVisibilityPromptsData(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);

  const categoryById = new Map(dataset.categories.map((category) => [category.id, category.name]));
  const productById = new Map(dataset.products.map((product) => [product.id, product]));

  const promptProductsRes = await args.supabase
    .from('monitoring_prompt_products')
    .select('prompt_id, product_id')
    .eq('project_id', args.projectId);

  const promptProductRows = (promptProductsRes.data || []) as Array<{ prompt_id: string; product_id: string }>;
  const productsByPrompt = new Map<string, Array<{ product_id: string; product_name: string }>>();

  for (const row of promptProductRows) {
    const product = productById.get(row.product_id);
    if (!product) continue;
    const list = productsByPrompt.get(row.prompt_id) || [];
    list.push({ product_id: product.id, product_name: product.product_name });
    productsByPrompt.set(row.prompt_id, list);
  }

  const resultsByPrompt = new Map<string, VisibilityRow[]>();
  for (const result of dataset.results) {
    if (!result.prompt_id) continue;
    const list = resultsByPrompt.get(result.prompt_id) || [];
    list.push(result);
    resultsByPrompt.set(result.prompt_id, list);
  }

  const prompts = dataset.prompts.map((prompt) => {
    const resultRows = resultsByPrompt.get(prompt.id) || [];

    const ownedVisibility = resultRows
      .filter((row) => row.is_owned_product)
      .reduce((sum, row) => sum + Math.max(0, toNumber(row.mention_count, 0)), 0);

    const competitorVisibility = resultRows
      .filter((row) => !row.is_owned_product)
      .reduce((sum, row) => sum + Math.max(0, toNumber(row.mention_count, 0)), 0);

    return {
      id: prompt.id,
      prompt_text: prompt.prompt_text,
      category_id: prompt.category_id,
      category: prompt.category_id ? categoryById.get(prompt.category_id) || null : null,
      buying_intent: prompt.buying_intent || prompt.intent || null,
      scope: prompt.scope || null,
      intent: prompt.intent || prompt.buying_intent || null,
      quality_status: prompt.quality_status || null,
      lifecycle_status: prompt.lifecycle_status || null,
      prompt_origin: prompt.prompt_origin || null,
      rationale: prompt.rationale || null,
      locale: prompt.locale || null,
      topic: prompt.topic_label,
      monitoring_frequency: prompt.monitoring_frequency || 'daily',
      is_active: prompt.is_active !== false,
      status: prompt.lifecycle_status || prompt.status || (prompt.is_active === false ? 'inactive' : 'active'),
      last_run: resultRows[resultRows.length - 1]?.created_at || null,
      responses_collected: resultRows.length,
      visibility_owned: ownedVisibility,
      visibility_competitors: competitorVisibility,
      target_products: productsByPrompt.get(prompt.id) || [],
    };
  });

  const generated = await generateProductVisibilityPrompts({
    supabase: args.supabase,
    projectId: args.projectId,
    persist: false,
  });

  return {
    prompts,
    suggested_prompts: generated.suggestions,
  };
}

/* -------------------------------------------------------------------------- */
/*  Vue d'ensemble — format standardisé { period, kpis, deltas, charts, tables } */
/* -------------------------------------------------------------------------- */

export type ProductVisibilityOverviewStandard = {
  period: {
    range: '7d' | '30d' | '90d';
    current_start: string;
    current_end: string;
    previous_start: string;
    previous_end: string;
  };
  kpis: {
    product_visibility_score: number | null;
    owned_product_mentions: number;
    competitor_product_mentions: number;
    average_product_ranking: number | null;
    ai_citation_coverage: number | null;
    high_opportunity_products: number;
    last_run: string | null;
  };
  deltas: {
    product_visibility_score: number | null;
    owned_product_mentions: number | null;
    competitor_product_mentions: number | null;
    average_product_ranking: number | null;
    ai_citation_coverage: number | null;
  };
  // Qualité de la donnée affichée. 'low' = échantillon insuffisant pour considérer
  // les KPI comme fiables ; l'UI ajoute alors un badge "faible confiance".
  // 'none' = aucune donnée du tout. 'high' = échantillon suffisant.
  reliability: {
    sample_size: number;
    confidence_level: 'high' | 'low' | 'none';
    min_sample: number;
  };
  charts: {
    visibility_trend: Array<{
      day: string;
      owned_mentions: number;
      competitor_mentions: number;
      total_mentions: number;
      visibility_score: number;
    }>;
    owned_vs_competitors: { owned: number; competitors: number };
    top_categories: Array<{
      category_id: string;
      category: string;
      owned_visibility: number;
      competitor_visibility: number;
      mentions: number;
    }>;
    top_products: Array<{
      product_id: string;
      product: string;
      brand: string | null;
      owned: boolean;
      mentions: number;
      visibility_score: number;
      avg_position: number | null;
      category: string | null;
    }>;
    absent_categories: Array<{
      category_id: string;
      category: string;
      competitor_mentions: number;
      products_tracked: number;
      opportunity_score: number;
    }>;
  };
  tables: {
    category_performance: Array<{
      category_id: string;
      category: string;
      owned_visibility: number;
      competitor_visibility: number;
      top_competitor: string | null;
      avg_ranking: number | null;
      opportunity_score: number;
      trend_delta: number;
      last_run: string | null;
    }>;
  };
  meta: {
    has_data: boolean;
    total_results_current: number;
    total_results_previous: number;
    products_count: number;
    prompts_count: number;
    latest_run_status: string | null;
    onboarding_stage: ProductVisibilityOnboardingStage;
  };
};

function diffOrNull(current: number | null | undefined, previous: number | null | undefined, digits = 1): number | null {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined) return null;
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  const multiplier = Math.pow(10, digits);
  return Math.round((cur - prev) * multiplier) / multiplier;
}

function totalResultsFromOverview(overview: any): number {
  const owned = Number(overview?.kpis?.owned_product_mentions ?? 0);
  const competitor = Number(overview?.kpis?.competitor_product_mentions ?? 0);
  return (Number.isFinite(owned) ? owned : 0) + (Number.isFinite(competitor) ? competitor : 0);
}

function getOnboardingStage(args: {
  productsCount: number;
  promptsCount: number;
  totalResults: number;
  latestRun: { id?: string; status?: string | null } | null;
}): ProductVisibilityOnboardingStage {
  if (args.productsCount === 0) return 'no_products';
  if (args.promptsCount === 0) return 'products_without_prompts';
  if (!args.latestRun) return 'ready_without_analysis';
  if (args.totalResults === 0) return 'analysis_without_results';
  return 'has_data';
}

function computeVisibilityScore(args: {
  ownedMentions: number;
  competitorMentions: number;
  averageOwnedRanking: number | null;
  ownedSourceCoverage: number | null;
}) {
  const totalMentions = args.ownedMentions + args.competitorMentions;
  if (totalMentions <= 0) return null;

  const ownedShare = args.ownedMentions / totalMentions;
  const rankingBonus = args.averageOwnedRanking
    ? clamp((10 - Math.min(args.averageOwnedRanking, 10)) / 9, 0, 1)
    : 0;
  const sourceBonus = args.ownedSourceCoverage !== null
    ? clamp(args.ownedSourceCoverage / 100, 0, 1)
    : 0;

  return round(ownedShare * 70 + rankingBonus * 20 + sourceBonus * 10, 1);
}

/**
 * Charge la vue d'ensemble du module Visibilité produit au format standardisé,
 * avec deltas calculés vis-à-vis de la période précédente équivalente.
 *
 * Cette fonction est volontairement un wrapper de `getProductVisibilityOverview`
 * pour ne pas casser les autres consommateurs existants pendant la migration.
 */
export async function getProductVisibilityOverviewStandard(args: {
  supabase: any;
  projectId: string;
  range: '7d' | '30d' | '90d';
  window: ProductVisibilityDateWindow;
  previousWindow: ProductVisibilityDateWindow;
}): Promise<ProductVisibilityOverviewStandard> {
  const [current, previous] = await Promise.all([
    getProductVisibilityOverview({ supabase: args.supabase, projectId: args.projectId, window: args.window }),
    getProductVisibilityOverview({ supabase: args.supabase, projectId: args.projectId, window: args.previousWindow }),
  ]);

  const [{ count: productsCount }, { count: promptsCount }, { data: latestRun }] = await Promise.all([
    args.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', args.projectId),
    args.supabase
      .from('monitoring_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', args.projectId)
      .neq('is_active', false),
    // Dernier run "produit" = dernier monitoring_run pour lequel au moins une ligne
    // product_visibility_results existe. Évite de remonter un run Radar IA sans
    // résultat produit comme "Dernière analyse".
    args.supabase
      .from('product_visibility_results')
      .select('run_id, created_at, monitoring_runs!inner(id, status, created_at, finished_at, project_id)')
      .eq('project_id', args.projectId)
      .not('run_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestRunRow = (latestRun as { monitoring_runs?: { id: string; status: string | null; created_at: string; finished_at: string | null } } | null)?.monitoring_runs || null;

  const totalCurrent = totalResultsFromOverview(current);
  const totalPrevious = totalResultsFromOverview(previous);
  const safeProductsCount = Number(productsCount || 0);
  const safePromptsCount = Number(promptsCount || 0);

  const sampleSize = totalCurrent;
  const confidenceLevel: 'high' | 'low' | 'none' = sampleSize === 0
    ? 'none'
    : sampleSize < PRODUCT_VISIBILITY_MIN_SAMPLE
      ? 'low'
      : 'high';

  return {
    period: {
      range: args.range,
      current_start: args.window.startDate,
      current_end: args.window.endDate,
      previous_start: args.previousWindow.startDate,
      previous_end: args.previousWindow.endDate,
    },
    kpis: {
      product_visibility_score: current.kpis.product_visibility_score,
      owned_product_mentions: Number(current.kpis.owned_product_mentions) || 0,
      competitor_product_mentions: Number(current.kpis.competitor_product_mentions) || 0,
      average_product_ranking: current.kpis.average_product_ranking,
      ai_citation_coverage: current.kpis.ai_citation_coverage,
      high_opportunity_products: Number(current.kpis.high_opportunity_products) || 0,
      last_run: latestRunRow?.finished_at || latestRunRow?.created_at || current.kpis.last_run,
    },
    deltas: {
      product_visibility_score: diffOrNull(current.kpis.product_visibility_score, previous.kpis.product_visibility_score, 1),
      owned_product_mentions: diffOrNull(current.kpis.owned_product_mentions, previous.kpis.owned_product_mentions, 0),
      competitor_product_mentions: diffOrNull(current.kpis.competitor_product_mentions, previous.kpis.competitor_product_mentions, 0),
      average_product_ranking: diffOrNull(current.kpis.average_product_ranking, previous.kpis.average_product_ranking, 2),
      ai_citation_coverage: diffOrNull(current.kpis.ai_citation_coverage, previous.kpis.ai_citation_coverage, 1),
    },
    reliability: {
      sample_size: sampleSize,
      confidence_level: confidenceLevel,
      min_sample: PRODUCT_VISIBILITY_MIN_SAMPLE,
    },
    charts: {
      visibility_trend: current.charts.visibility_trend,
      owned_vs_competitors: current.charts.owned_vs_competitor,
      top_categories: current.charts.top_categories_by_visibility,
      top_products: current.charts.top_products_visible,
      absent_categories: current.charts.absent_categories,
    },
    tables: {
      category_performance: current.table,
    },
    meta: {
      has_data: totalCurrent > 0,
      total_results_current: totalCurrent,
      total_results_previous: totalPrevious,
      products_count: safeProductsCount,
      prompts_count: safePromptsCount,
      latest_run_status: latestRunRow?.status || null,
      onboarding_stage: getOnboardingStage({
        productsCount: safeProductsCount,
        promptsCount: safePromptsCount,
        totalResults: totalCurrent,
        latestRun: latestRunRow,
      }),
    },
  };
}

/** Retourne une réponse vide bien formée (utilisée en fallback d'erreur). */
export function emptyProductVisibilityOverviewStandard(args: {
  range: '7d' | '30d' | '90d';
  window: ProductVisibilityDateWindow;
  previousWindow: ProductVisibilityDateWindow;
}): ProductVisibilityOverviewStandard {
  return {
    period: {
      range: args.range,
      current_start: args.window.startDate,
      current_end: args.window.endDate,
      previous_start: args.previousWindow.startDate,
      previous_end: args.previousWindow.endDate,
    },
    kpis: {
      product_visibility_score: null,
      owned_product_mentions: 0,
      competitor_product_mentions: 0,
      average_product_ranking: null,
      ai_citation_coverage: null,
      high_opportunity_products: 0,
      last_run: null,
    },
    reliability: {
      sample_size: 0,
      confidence_level: 'none',
      min_sample: PRODUCT_VISIBILITY_MIN_SAMPLE,
    },
    deltas: {
      product_visibility_score: null,
      owned_product_mentions: null,
      competitor_product_mentions: null,
      average_product_ranking: null,
      ai_citation_coverage: null,
    },
    charts: {
      visibility_trend: [],
      owned_vs_competitors: { owned: 0, competitors: 0 },
      top_categories: [],
      top_products: [],
      absent_categories: [],
    },
    tables: {
      category_performance: [],
    },
    meta: {
      has_data: false,
      total_results_current: 0,
      total_results_previous: 0,
      products_count: 0,
      prompts_count: 0,
      latest_run_status: null,
      onboarding_stage: 'no_products',
    },
  };
}

export type ProductVisibilityProductCreateInput = {
  name: string;
  brand?: string | null;
  url?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  description?: string | null;
  useCase?: string | null;
  targetCustomer?: string | null;
  attributes?: string | null;
  isOwnedProduct?: boolean;
  competitorBrand?: string | null;
  imageUrl?: string | null;
};

export async function createProductVisibilityCategory(args: {
  supabase: any;
  projectId: string;
  name: string;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
}) {
  const name = args.name.trim();
  if (!name) throw new Error('Le nom de la catégorie est obligatoire.');

  const existing = await args.supabase
    .from('product_categories')
    .select('id, name')
    .eq('project_id', args.projectId)
    .ilike('name', name)
    .maybeSingle();

  if (existing.data?.id) return existing.data;

  const { data, error } = await args.supabase
    .from('product_categories')
    .insert({
      project_id: args.projectId,
      name,
      description: args.description?.trim() || null,
      priority: args.priority || 'medium',
      status: args.status || 'active',
    })
    .select('id, name')
    .single();

  if (error || !data) throw new Error(error?.message || 'Impossible de créer la catégorie.');
  return data;
}

function parseAttributeInput(attributes: string | null | undefined) {
  if (!attributes) return [];
  return attributes
    .split(/[,;\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function createProductVisibilityProduct(args: {
  supabase: any;
  projectId: string;
  input: ProductVisibilityProductCreateInput;
}) {
  const name = args.input.name.trim();
  if (!name) throw new Error('Le nom du produit est obligatoire.');

  let categoryId = args.input.categoryId || null;
  if (!categoryId && args.input.categoryName?.trim()) {
    const category = await createProductVisibilityCategory({
      supabase: args.supabase,
      projectId: args.projectId,
      name: args.input.categoryName,
    });
    categoryId = category.id;
  }

  const attributes = parseAttributeInput(args.input.attributes);
  const productAttributes: Record<string, unknown> = {
    attributs_cles: attributes,
  };
  if (args.input.description?.trim()) {
    productAttributes.description = args.input.description.trim();
  }
  if (args.input.useCase?.trim()) {
    productAttributes.use_case = args.input.useCase.trim();
  }
  if (args.input.targetCustomer?.trim()) {
    productAttributes.target_customer = args.input.targetCustomer.trim();
  }

  const basePayload = {
    project_id: args.projectId,
    category_id: categoryId,
    product_name: name,
    brand_name: args.input.brand?.trim() || null,
    product_url: args.input.url?.trim() || null,
    attributes: productAttributes,
    target_keywords: attributes,
    is_owned_product: args.input.isOwnedProduct !== false,
    competitor_brand: args.input.isOwnedProduct === false
      ? args.input.competitorBrand?.trim() || args.input.brand?.trim() || null
      : null,
    image_url: args.input.imageUrl?.trim() || null,
    status: 'active',
  };

  const foundationPayload = {
    ...basePayload,
    description: args.input.description?.trim() || null,
    use_case: args.input.useCase?.trim() || null,
    target_customer: args.input.targetCustomer?.trim() || null,
  };

  let insertResult = await args.supabase
    .from('products')
    .insert(foundationPayload)
    .select('id, product_name, category_id')
    .single();

  if (insertResult.error && isMissingProductFoundationColumnError(insertResult.error)) {
    insertResult = await args.supabase
      .from('products')
      .insert(basePayload)
      .select('id, product_name, category_id')
      .single();
  }

  const { data, error } = insertResult;

  if (error || !data) throw new Error(error?.message || 'Impossible de créer le produit.');
  return data;
}

export async function getProductVisibilityResults(args: {
  supabase: any;
  projectId: string;
  window: ProductVisibilityDateWindow;
}) {
  const dataset = await loadVisibilityDataset(args);
  const productById = new Map(dataset.products.map((product) => [product.id, product]));
  const categoryById = new Map(dataset.categories.map((category) => [category.id, category.name]));
  const promptById = new Map(dataset.prompts.map((prompt) => [prompt.id, prompt]));

  const responsesRes = await args.supabase
    .from('monitoring_responses')
    .select('id, prompt_run_id, raw_text, model_used, created_at')
    .eq('project_id', args.projectId)
    .order('created_at', { ascending: false })
    .limit(100);

  const responseByRunId = new Map(
    ((responsesRes.data || []) as Array<{
      id: string;
      prompt_run_id: string;
      raw_text: string | null;
      model_used: string | null;
      created_at: string;
    }>).map((response) => [response.prompt_run_id, response]),
  );

  const rows = dataset.results
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((result) => {
      const product = result.product_id ? productById.get(result.product_id) : null;
      const prompt = result.prompt_id ? promptById.get(result.prompt_id) : null;
      const response = result.prompt_run_id ? responseByRunId.get(result.prompt_run_id) : null;

      return {
        id: result.id,
        created_at: result.created_at,
        prompt_text: prompt?.prompt_text || null,
        buying_intent: result.buying_intent || prompt?.buying_intent || null,
        category: result.category_id ? categoryById.get(result.category_id) || null : null,
        product_name: product?.product_name || null,
        detected_product_name: result.detected_product_name,
        brand_name: result.detected_brand_name || product?.brand_name || product?.competitor_brand || null,
        is_owned_product: result.is_owned_product === true,
        rank_position: result.rank_position,
        mention_count: Math.max(0, toNumber(result.mention_count, 0)),
        visibility_score: result.visibility_score,
        sentiment_score: result.sentiment_score,
        accuracy_score: result.accuracy_score,
        confidence_score: result.confidence_score,
        attributes_detected: parseAttributes(result.attributes_detected),
        sources_detected: parseSources(result.sources_detected),
        raw_answer: result.raw_answer || response?.raw_text || null,
        model_used: result.ai_model || response?.model_used || null,
      };
    });

  const responsesCollected = new Set(dataset.results.map((result) => result.prompt_run_id).filter(Boolean)).size;
  const detectedProducts = rows.filter((row) => row.mention_count > 0 && row.product_name).length;

  return {
    summary: {
      results_count: rows.length,
      responses_collected: responsesCollected,
      detected_products: detectedProducts,
      owned_mentions: rows.filter((row) => row.is_owned_product).reduce((sum, row) => sum + row.mention_count, 0),
      competitor_mentions: rows.filter((row) => !row.is_owned_product).reduce((sum, row) => sum + row.mention_count, 0),
    },
    results: rows,
  };
}
