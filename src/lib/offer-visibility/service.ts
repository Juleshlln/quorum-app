import { randomUUID } from 'crypto';
import { queryOpenAI } from '@/lib/ai/providers';
import { getOfferVisibilityPlanConfig, type OfferVisibilityPlanConfig } from '@/lib/plans';
import { analyzeOfferAnswer } from '@/lib/offer-visibility/analysis';
import { generateOfferPrompts, getDefaultOfferIntents } from '@/lib/offer-visibility/prompts';
import { computeCompetitorScores, computeOfferScore } from '@/lib/offer-visibility/scoring';
import type {
  OfferCategory,
  OfferCompetitorScore,
  OfferCreateInput,
  OfferDetail,
  OfferIntent,
  OfferListItem,
  OfferMention,
  OfferPrompt,
  OfferPromptRun,
  OfferRecommendation,
  OfferUpdateInput,
  OfferVisibilityPlanUsage,
} from '@/lib/offer-visibility/types';

const DEFAULT_COUNTRY = 'France';
const DEFAULT_LANGUAGE = 'fr';
const DEFAULT_MODEL = process.env.OFFER_VISIBILITY_MODEL || 'gpt-4o';
const DEFAULT_MAX_PROMPTS_PER_RUN = Number(process.env.OFFER_VISIBILITY_MAX_PROMPTS_PER_RUN || 8);

type ProjectContext = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  description: string | null;
  location: string | null;
  industry: string | null;
  keywords: string[] | null;
};

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function assertOfferName(name: unknown) {
  const value = String(name || '').trim();
  if (value.length < 2) {
    throw new Error('Le nom de l’offre est requis.');
  }
  return value.slice(0, 120);
}

function buildBrandContext(project: ProjectContext, offer?: OfferCategory | null) {
  const parts: string[] = [`Marque à mesurer: ${project.name}.`];
  if (project.website) parts.push(`Site officiel: ${project.website}.`);
  if (project.description) parts.push(`Description: ${project.description}.`);
  if (project.location) parts.push(`Localisation: ${project.location}.`);
  if (project.industry) parts.push(`Secteur: ${project.industry}.`);
  if (Array.isArray(project.keywords) && project.keywords.length > 0) {
    parts.push(`Mots-clés: ${project.keywords.join(', ')}.`);
  }
  if (offer) {
    parts.push(`Offre suivie: ${offer.name}.`);
    if (offer.description) parts.push(`Description de l’offre: ${offer.description}.`);
    if (offer.target_market) parts.push(`Marché cible: ${offer.target_market}.`);
    if (offer.country) parts.push(`Pays: ${offer.country}.`);
  }
  parts.push('Réponds naturellement en français. Ne cite pas la marque mesurée si elle ne fait pas partie des options pertinentes.');
  return parts.join('\n');
}

function toProjectContext(row: any): ProjectContext {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    website: row.website ?? null,
    description: row.description ?? null,
    location: row.location ?? null,
    industry: row.industry ?? null,
    keywords: Array.isArray(row.keywords) ? row.keywords : null,
  };
}

async function loadProject(supabase: any, projectId: string): Promise<ProjectContext> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, name, website, description, location, industry, keywords')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Marque introuvable.');
  }
  return toProjectContext(data);
}

export async function getOfferVisibilityPlanForProject(args: {
  supabase: any;
  projectId: string;
}): Promise<OfferVisibilityPlanConfig> {
  const project = await loadProject(args.supabase, args.projectId);

  try {
    const { data, error } = await args.supabase
      .from('profiles')
      .select('plan')
      .eq('id', project.user_id)
      .maybeSingle();

    if (error) {
      return getOfferVisibilityPlanConfig('starter');
    }

    return getOfferVisibilityPlanConfig(data?.plan || 'starter');
  } catch {
    return getOfferVisibilityPlanConfig('starter');
  }
}

export async function getOfferVisibilityPlanUsage(args: {
  supabase: any;
  projectId: string;
  offerId?: string | null;
}): Promise<OfferVisibilityPlanUsage> {
  const { count: activeOffers } = await args.supabase
    .from('offer_categories')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', args.projectId)
    .eq('is_active', true);

  let activePromptsForOffer: number | undefined;
  let offerRunsThisMonth: number | undefined;

  if (args.offerId) {
    const { count: promptsCount } = await args.supabase
      .from('offer_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('offer_category_id', args.offerId)
      .eq('is_active', true);
    activePromptsForOffer = Number(promptsCount || 0);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: runRows } = await args.supabase
      .from('offer_prompt_runs')
      .select('analysis_batch_id, created_at')
      .eq('offer_category_id', args.offerId)
      .gte('created_at', monthStart.toISOString());

    const batches = new Set(
      (runRows || [])
        .map((row: any) => row.analysis_batch_id || row.created_at)
        .filter(Boolean),
    );
    offerRunsThisMonth = batches.size;
  }

  return {
    activeOffers: Number(activeOffers || 0),
    activePromptsForOffer,
    offerRunsThisMonth,
  };
}

function limitLabel(limit: number | null) {
  return limit === null ? 'illimité' : String(limit);
}

async function assertCanCreateOffer(args: {
  supabase: any;
  projectId: string;
}) {
  const plan = await getOfferVisibilityPlanForProject(args);
  if (plan.limits.maxOffers === null) return plan;

  const usage = await getOfferVisibilityPlanUsage(args);
  if (usage.activeOffers >= plan.limits.maxOffers) {
    throw new Error(`Votre plan ${plan.label} permet ${limitLabel(plan.limits.maxOffers)} offres suivies actives. Passez à un plan supérieur pour en ajouter davantage.`);
  }
  return plan;
}

async function assertCanAddPrompt(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  const plan = await getOfferVisibilityPlanForProject(args);
  if (plan.limits.maxPromptsPerOffer === null) return plan;

  const usage = await getOfferVisibilityPlanUsage({
    supabase: args.supabase,
    projectId: args.projectId,
    offerId: args.offerId,
  });
  if ((usage.activePromptsForOffer || 0) >= plan.limits.maxPromptsPerOffer) {
    throw new Error(`Votre plan ${plan.label} permet ${limitLabel(plan.limits.maxPromptsPerOffer)} questions suivies par offre. Désactivez une question ou passez à un plan supérieur.`);
  }
  return plan;
}

async function assertCanRunOfferAnalysis(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  const plan = await getOfferVisibilityPlanForProject(args);
  if (plan.limits.maxOfferRunsPerMonth === null) return plan;

  const usage = await getOfferVisibilityPlanUsage({
    supabase: args.supabase,
    projectId: args.projectId,
    offerId: args.offerId,
  });
  if ((usage.offerRunsThisMonth || 0) >= plan.limits.maxOfferRunsPerMonth) {
    throw new Error(`Votre plan ${plan.label} permet ${limitLabel(plan.limits.maxOfferRunsPerMonth)} analyses d’offre par mois. Les limites sont désactivées en environnement de développement.`);
  }
  return plan;
}

async function loadCompetitors(supabase: any, projectId: string) {
  const [competitorsRes, concurrentsRes] = await Promise.all([
    supabase.from('competitors').select('name, domain').eq('project_id', projectId),
    supabase.from('concurrents').select('nom, domaine').eq('project_id', projectId),
  ]);

  const rows = [
    ...(competitorsRes.data || []).map((row: any) => ({ name: row.name, domain: row.domain || null })),
    ...(concurrentsRes.data || []).map((row: any) => ({ name: row.nom, domain: row.domaine || null })),
  ];

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = normalize(row.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadOffersBase(supabase: any, projectId: string): Promise<OfferCategory[]> {
  const { data, error } = await supabase
    .from('offer_categories')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as OfferCategory[];
}

async function loadOfferBase(supabase: any, projectId: string, offerId: string): Promise<OfferCategory | null> {
  const { data, error } = await supabase
    .from('offer_categories')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', offerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data || null) as OfferCategory | null;
}

async function loadOfferChildren(supabase: any, offerIds: string[]) {
  if (offerIds.length === 0) {
    return { intents: [], prompts: [], runs: [], mentions: [] };
  }

  const [intentsRes, promptsRes, runsRes, mentionsRes] = await Promise.all([
    supabase
      .from('offer_intents')
      .select('*')
      .in('offer_category_id', offerIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('offer_prompts')
      .select('*')
      .in('offer_category_id', offerIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('offer_prompt_runs')
      .select('*')
      .in('offer_category_id', offerIds)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('offer_visibility_mentions')
      .select('*')
      .in('offer_category_id', offerIds)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const firstError = intentsRes.error || promptsRes.error || runsRes.error || mentionsRes.error;
  if (firstError) throw new Error(firstError.message);

  const intents = (intentsRes.data || []) as OfferIntent[];
  const intentById = new Map(intents.map((intent) => [intent.id, intent]));
  const prompts = ((promptsRes.data || []) as OfferPrompt[]).map((prompt) => ({
    ...prompt,
    intent: prompt.offer_intent_id ? intentById.get(prompt.offer_intent_id) || null : null,
  }));

  return {
    intents,
    prompts,
    runs: (runsRes.data || []) as OfferPromptRun[],
    mentions: (mentionsRes.data || []) as OfferMention[],
  };
}

function filterByOffer<T extends { offer_category_id: string }>(rows: T[], offerId: string) {
  return rows.filter((row) => row.offer_category_id === offerId);
}

export async function getOffers(args: {
  supabase: any;
  projectId: string;
}): Promise<{ offers: OfferListItem[] }> {
  const offers = await loadOffersBase(args.supabase, args.projectId);
  const children = await loadOfferChildren(args.supabase, offers.map((offer) => offer.id));

  return {
    offers: offers.map((offer) => ({
      ...offer,
      metrics: computeOfferScore({
        prompts: filterByOffer(children.prompts, offer.id),
        runs: filterByOffer(children.runs, offer.id),
        mentions: filterByOffer(children.mentions, offer.id),
      }),
    })),
  };
}

export async function createOffer(args: {
  supabase: any;
  projectId: string;
  userId: string;
  input: OfferCreateInput;
}) {
  const name = assertOfferName(args.input.name);
  if (!['product_category', 'service'].includes(args.input.type)) {
    throw new Error('Le type d’offre est invalide.');
  }

  const { data: existing } = await args.supabase
    .from('offer_categories')
    .select('id')
    .eq('project_id', args.projectId)
    .eq('type', args.input.type)
    .ilike('name', name)
    .maybeSingle();

  if (existing?.id) {
    throw new Error('Cette offre est déjà suivie.');
  }

  await assertCanCreateOffer({
    supabase: args.supabase,
    projectId: args.projectId,
  });

  const { data, error } = await args.supabase
    .from('offer_categories')
    .insert({
      project_id: args.projectId,
      user_id: args.userId,
      name,
      type: args.input.type,
      description: args.input.description?.trim() || null,
      business_priority: args.input.business_priority || 'medium',
      target_market: args.input.target_market?.trim() || null,
      country: args.input.country?.trim() || DEFAULT_COUNTRY,
      language: args.input.language?.trim() || DEFAULT_LANGUAGE,
      is_active: true,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Création impossible.');

  const offer = data as OfferCategory;
  const intents = await ensureDefaultIntents({ supabase: args.supabase, offer });
  let prompts: OfferPrompt[] = [];
  if (args.input.generate_prompts !== false) {
    const project = await loadProject(args.supabase, args.projectId);
    const competitors = await loadCompetitors(args.supabase, args.projectId);
    prompts = await generatePromptsForOffer({
      supabase: args.supabase,
      project,
      offer,
      competitors,
    });
  }

  return { offer, intents, prompts };
}

export async function updateOffer(args: {
  supabase: any;
  projectId: string;
  offerId: string;
  input: OfferUpdateInput;
}) {
  const offer = await loadOfferBase(args.supabase, args.projectId, args.offerId);
  if (!offer) throw new Error('Offre introuvable.');

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (args.input.name !== undefined) patch.name = assertOfferName(args.input.name);
  if (args.input.description !== undefined) patch.description = args.input.description?.trim() || null;
  if (args.input.type !== undefined) patch.type = args.input.type;
  if (args.input.business_priority !== undefined) patch.business_priority = args.input.business_priority;
  if (args.input.target_market !== undefined) patch.target_market = args.input.target_market?.trim() || null;
  if (args.input.country !== undefined) patch.country = args.input.country?.trim() || DEFAULT_COUNTRY;
  if (args.input.language !== undefined) patch.language = args.input.language?.trim() || DEFAULT_LANGUAGE;
  if (args.input.is_active !== undefined) patch.is_active = Boolean(args.input.is_active);

  const { data, error } = await args.supabase
    .from('offer_categories')
    .update(patch)
    .eq('id', offer.id)
    .eq('project_id', args.projectId)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Mise à jour impossible.');
  return data as OfferCategory;
}

export async function deactivateOffer(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  return updateOffer({
    supabase: args.supabase,
    projectId: args.projectId,
    offerId: args.offerId,
    input: { is_active: false },
  });
}

export async function ensureDefaultIntents(args: {
  supabase: any;
  offer: OfferCategory;
}): Promise<OfferIntent[]> {
  const defaults = getDefaultOfferIntents(args.offer.type);
  const { data: existingData, error: existingError } = await args.supabase
    .from('offer_intents')
    .select('*')
    .eq('offer_category_id', args.offer.id);

  if (existingError) throw new Error(existingError.message);
  const existing = (existingData || []) as OfferIntent[];
  const existingKeys = new Set(existing.map((intent) => `${normalize(intent.label)}:${intent.intent_type}`));
  const rows = defaults
    .filter((intent) => !existingKeys.has(`${normalize(intent.label)}:${intent.intent_type}`))
    .map((intent) => ({
      offer_category_id: args.offer.id,
      ...intent,
    }));

  if (rows.length > 0) {
    const { data, error } = await args.supabase
      .from('offer_intents')
      .insert(rows)
      .select('*');
    if (error) throw new Error(error.message);
    return [...existing, ...((data || []) as OfferIntent[])];
  }

  return existing;
}

export async function generatePromptsForOffer(args: {
  supabase: any;
  project: ProjectContext;
  offer: OfferCategory;
  competitors?: Array<{ name: string; domain?: string | null }>;
}): Promise<OfferPrompt[]> {
  const intents = await ensureDefaultIntents({ supabase: args.supabase, offer: args.offer });
  const intentByType = new Map(intents.map((intent) => [intent.intent_type, intent]));
  const suggestions = generateOfferPrompts({
    offer: args.offer,
    brandName: args.project.name,
    competitors: (args.competitors || []).map((competitor) => competitor.name),
  });

  const { data: existingData, error: existingError } = await args.supabase
    .from('offer_prompts')
    .select('*')
    .eq('offer_category_id', args.offer.id);
  if (existingError) throw new Error(existingError.message);

  const existing = (existingData || []) as OfferPrompt[];
  const plan = await getOfferVisibilityPlanForProject({
    supabase: args.supabase,
    projectId: args.project.id,
  });
  const activePromptCount = existing.filter((prompt) => prompt.is_active).length;
  const remainingPrompts = plan.limits.maxPromptsPerOffer === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, plan.limits.maxPromptsPerOffer - activePromptCount);
  const existingPrompts = new Set(existing.map((prompt) => normalize(prompt.prompt)));
  const rows = suggestions
    .filter((suggestion) => !existingPrompts.has(normalize(suggestion.prompt)))
    .slice(0, remainingPrompts)
    .map((suggestion) => ({
      offer_category_id: args.offer.id,
      offer_intent_id: intentByType.get(suggestion.intent_type)?.id || null,
      prompt: suggestion.prompt,
      language: args.offer.language || DEFAULT_LANGUAGE,
      country: args.offer.country || DEFAULT_COUNTRY,
      ai_provider: 'openai',
      is_active: true,
      source: 'generated',
    }));

  if (rows.length === 0) return existing;

  const { data, error } = await args.supabase
    .from('offer_prompts')
    .insert(rows)
    .select('*');
  if (error) throw new Error(error.message);

  return [...existing, ...((data || []) as OfferPrompt[])];
}

export async function generatePromptsForOfferId(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  const offer = await loadOfferBase(args.supabase, args.projectId, args.offerId);
  if (!offer) throw new Error('Offre introuvable.');
  const project = await loadProject(args.supabase, args.projectId);
  const competitors = await loadCompetitors(args.supabase, args.projectId);
  const prompts = await generatePromptsForOffer({ supabase: args.supabase, project, offer, competitors });
  return { offer, prompts };
}

export async function addOfferPrompt(args: {
  supabase: any;
  projectId: string;
  offerId: string;
  prompt: string;
  intentId?: string | null;
}) {
  const offer = await loadOfferBase(args.supabase, args.projectId, args.offerId);
  if (!offer) throw new Error('Offre introuvable.');
  const promptText = String(args.prompt || '').trim();
  if (promptText.length < 8) throw new Error('La question suivie est trop courte.');

  await assertCanAddPrompt({
    supabase: args.supabase,
    projectId: args.projectId,
    offerId: offer.id,
  });

  const { data, error } = await args.supabase
    .from('offer_prompts')
    .insert({
      offer_category_id: offer.id,
      offer_intent_id: args.intentId || null,
      prompt: promptText,
      language: offer.language || DEFAULT_LANGUAGE,
      country: offer.country || DEFAULT_COUNTRY,
      ai_provider: 'openai',
      is_active: true,
      source: 'manual',
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Ajout impossible.');
  return data as OfferPrompt;
}

export async function setOfferPromptActive(args: {
  supabase: any;
  projectId: string;
  offerId: string;
  promptId: string;
  isActive: boolean;
}) {
  const offer = await loadOfferBase(args.supabase, args.projectId, args.offerId);
  if (!offer) throw new Error('Offre introuvable.');

  const { data, error } = await args.supabase
    .from('offer_prompts')
    .update({ is_active: args.isActive, updated_at: new Date().toISOString() })
    .eq('id', args.promptId)
    .eq('offer_category_id', offer.id)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Mise à jour de la question impossible.');
  return data as OfferPrompt;
}

export async function getOfferDetail(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}): Promise<OfferDetail | null> {
  const offer = await loadOfferBase(args.supabase, args.projectId, args.offerId);
  if (!offer) return null;

  const children = await loadOfferChildren(args.supabase, [offer.id]);
  const prompts = filterByOffer(children.prompts, offer.id);
  const runs = filterByOffer(children.runs, offer.id);
  const mentions = filterByOffer(children.mentions, offer.id);
  const mentionsByRun = new Map<string, OfferMention[]>();
  for (const mention of mentions) {
    const list = mentionsByRun.get(mention.offer_prompt_run_id) || [];
    list.push(mention);
    mentionsByRun.set(mention.offer_prompt_run_id, list);
  }

  const metrics = computeOfferScore({ prompts, runs, mentions });
  const competitors = computeCompetitorScores({ runs, mentions });

  return {
    offer,
    metrics,
    intents: filterByOffer(children.intents, offer.id),
    prompts,
    runs: runs.map((run) => ({
      ...run,
      mentions: mentionsByRun.get(run.id) || [],
    })),
    competitors,
    recommendations: buildOfferRecommendations({
      offer,
      metrics,
      competitors,
      prompts,
    }),
  };
}

export function buildOfferRecommendations(args: {
  offer: OfferCategory;
  metrics: ReturnType<typeof computeOfferScore>;
  competitors: OfferCompetitorScore[];
  prompts: OfferPrompt[];
}): OfferRecommendation[] {
  const recs: OfferRecommendation[] = [];
  const label = args.offer.type === 'service' ? 'service' : 'catégorie';
  const appearance = args.metrics.appearance_rate ?? 0;
  const recommendation = args.metrics.recommendation_rate ?? 0;

  if (args.metrics.successful_runs === 0) {
    return [{
      id: 'no-analysis',
      title: 'Lancer une première analyse',
      description: 'Aucun résultat n’existe encore pour cette offre. Lancez une analyse pour mesurer votre visibilité IA et identifier les concurrents cités.',
      priority: 'high',
      reason: 'no_successful_runs',
    }];
  }

  if (appearance < 0.25) {
    recs.push({
      id: 'low-appearance',
      title: `Renforcer la page dédiée à cette ${label}`,
      description: `Votre marque apparaît peu sur ${args.offer.name}. Créez ou enrichissez une page dédiée avec des contenus explicites répondant aux intentions d’achat détectées.`,
      priority: 'high',
      reason: 'appearance_rate_below_25',
    });
  }

  const dominantCompetitor = args.competitors.find((competitor) =>
    args.metrics.successful_runs > 0 && competitor.prompts.length / args.metrics.successful_runs > 0.5
  );
  if (dominantCompetitor) {
    recs.push({
      id: `dominant-${normalize(dominantCompetitor.name)}`,
      title: `Analyser ${dominantCompetitor.name}`,
      description: `Le concurrent ${dominantCompetitor.name} est très visible sur cette offre. Analysez ses sources visibles et créez un contenu comparatif ou une page alternative si cela est pertinent.`,
      priority: 'high',
      reason: 'competitor_visible_above_50',
    });
  }

  if (args.metrics.average_position !== null && args.metrics.average_position > 3) {
    recs.push({
      id: 'weak-position',
      title: 'Améliorer la crédibilité perçue',
      description: 'Votre marque est mentionnée mais rarement en première position. Renforcez les preuves concrètes : avis, cas clients, certifications, délais, prix et disponibilité.',
      priority: 'medium',
      reason: 'average_position_above_3',
    });
  }

  if (recommendation < appearance) {
    recs.push({
      id: 'citation-not-recommendation',
      title: 'Clarifier la proposition de valeur',
      description: 'Votre marque est citée mais pas toujours recommandée. Rendez les bénéfices, cas d’usage et preuves de performance plus explicites sur cette offre.',
      priority: 'medium',
      reason: 'recommendation_rate_below_appearance_rate',
    });
  }

  const purchasePrompts = args.prompts.filter((prompt) =>
    prompt.intent?.intent_type === 'purchase' || /acheter|fournisseur|prestataire|choisir/i.test(prompt.prompt)
  );
  if (purchasePrompts.length < 2) {
    recs.push({
      id: 'few-purchase-prompts',
      title: 'Ajouter des questions orientées achat',
      description: 'Ajoutez des questions suivies proches de la conversion pour mesurer votre visibilité sur les recherches les plus business.',
      priority: 'low',
      reason: 'few_purchase_prompts',
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'keep-monitoring',
      title: 'Poursuivre le suivi',
      description: 'Les premiers signaux sont exploitables. Continuez les analyses régulières et enrichissez les questions suivies sur les angles où les concurrents apparaissent.',
      priority: 'low',
      reason: 'baseline_ok',
    });
  }

  return recs.slice(0, 6);
}

export async function runOfferAnalysis(args: {
  supabase: any;
  projectId: string;
  offerId: string;
  maxPrompts?: number;
}) {
  const offer = await loadOfferBase(args.supabase, args.projectId, args.offerId);
  if (!offer) throw new Error('Offre introuvable.');
  if (!offer.is_active) throw new Error('Cette offre est inactive.');

  const project = await loadProject(args.supabase, args.projectId);
  const competitors = await loadCompetitors(args.supabase, args.projectId);
  const plan = await assertCanRunOfferAnalysis({
    supabase: args.supabase,
    projectId: args.projectId,
    offerId: offer.id,
  });
  const children = await loadOfferChildren(args.supabase, [offer.id]);
  const activePrompts = filterByOffer(children.prompts, offer.id).filter((prompt) => prompt.is_active);
  const planMaxPrompts = plan.limits.maxPromptsPerRun ?? activePrompts.length;
  const requestedMaxPrompts = args.maxPrompts || planMaxPrompts || DEFAULT_MAX_PROMPTS_PER_RUN;
  const maxPrompts = Math.max(1, Math.min(requestedMaxPrompts, planMaxPrompts || requestedMaxPrompts));
  const promptsToRun = activePrompts.slice(0, maxPrompts);
  const analysisBatchId = randomUUID();

  if (promptsToRun.length === 0) {
    throw new Error('Aucune question active à analyser.');
  }

  const context = buildBrandContext(project, offer);
  let success = 0;
  let failed = 0;
  let mentionsInserted = 0;
  const errors: string[] = [];

  for (const prompt of promptsToRun) {
    const { data: pendingRun, error: pendingError } = await args.supabase
      .from('offer_prompt_runs')
      .insert({
        offer_prompt_id: prompt.id,
        offer_category_id: offer.id,
        analysis_batch_id: analysisBatchId,
        ai_provider: prompt.ai_provider || 'openai',
        model: DEFAULT_MODEL,
        prompt: prompt.prompt,
        status: 'pending',
      })
      .select('*')
      .single();

    if (pendingError || !pendingRun) {
      failed += 1;
      errors.push(pendingError?.message || 'Création du run impossible.');
      continue;
    }

    try {
      const result = await queryOpenAI(
        prompt.prompt,
        project.name,
        competitors.map((competitor) => competitor.name),
        context,
        {
          model: DEFAULT_MODEL,
          temperature: 0,
          top_p: 1,
          max_tokens: 1200,
          require_sources: false,
        },
      );

      const detectedMentions = analyzeOfferAnswer({
        answer: result.response,
        brandName: project.name,
        brandDomain: project.website,
        competitors,
      });

      await args.supabase
        .from('offer_prompt_runs')
        .update({
          answer: result.response,
          status: 'success',
          model: result.model,
          raw_response: {
            provider: result.provider,
            params: result.params,
            response_time_ms: result.response_time_ms,
            sources_cited: result.sources_cited,
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', pendingRun.id);

      if (detectedMentions.length > 0) {
        const { error: mentionError } = await args.supabase
          .from('offer_visibility_mentions')
          .insert(detectedMentions.map((mention) => ({
            offer_prompt_run_id: pendingRun.id,
            offer_category_id: offer.id,
            ...mention,
          })));
        if (mentionError) throw new Error(mentionError.message);
        mentionsInserted += detectedMentions.length;
      }

      success += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Erreur IA inconnue.';
      errors.push(message);
      await args.supabase
        .from('offer_prompt_runs')
        .update({
          status: 'failed',
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', pendingRun.id);
    }
  }

  const detail = await getOfferDetail({
    supabase: args.supabase,
    projectId: args.projectId,
    offerId: args.offerId,
  });

  return {
    offer_id: offer.id,
    prompts_requested: activePrompts.length,
    prompts_run: promptsToRun.length,
    prompts_skipped_by_limit: Math.max(0, activePrompts.length - promptsToRun.length),
    plan: {
      label: plan.label,
      max_prompts_per_run: plan.limits.maxPromptsPerRun,
      max_runs_per_month: plan.limits.maxOfferRunsPerMonth,
      development_unlimited: plan.isDevelopmentUnlimited,
    },
    success,
    failed,
    mentions_inserted: mentionsInserted,
    errors,
    metrics: detail?.metrics ?? null,
  };
}

export async function getOfferRuns(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  const detail = await getOfferDetail(args);
  if (!detail) throw new Error('Offre introuvable.');
  return { runs: detail.runs };
}

export async function getOfferCompetitors(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  const detail = await getOfferDetail(args);
  if (!detail) throw new Error('Offre introuvable.');
  return { competitors: detail.competitors };
}

export async function getOfferRecommendations(args: {
  supabase: any;
  projectId: string;
  offerId: string;
}) {
  const detail = await getOfferDetail(args);
  if (!detail) throw new Error('Offre introuvable.');
  return { recommendations: detail.recommendations };
}

export async function runOfferVisibilityCron(args: {
  supabase: any;
  maxOffers?: number;
  maxPromptsPerOffer?: number;
}) {
  const { data: offers, error } = await args.supabase
    .from('offer_categories')
    .select('id, project_id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(args.maxOffers || 20);

  if (error) throw new Error(error.message);

  const results = [];
  for (const offer of offers || []) {
    try {
      const result = await runOfferAnalysis({
        supabase: args.supabase,
        projectId: offer.project_id,
        offerId: offer.id,
        maxPrompts: args.maxPromptsPerOffer || DEFAULT_MAX_PROMPTS_PER_RUN,
      });
      results.push({ project_id: offer.project_id, ok: true, ...result });
    } catch (error) {
      results.push({
        offer_id: offer.id,
        project_id: offer.project_id,
        ok: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  return {
    offers_processed: results.length,
    ai_calls: results.reduce((sum, result: any) => sum + Number(result.prompts_run || 0), 0),
    results,
  };
}
