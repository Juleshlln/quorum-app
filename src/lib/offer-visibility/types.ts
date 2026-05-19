export type OfferType = 'product_category' | 'service';
export type OfferPriority = 'high' | 'medium' | 'low';
export type OfferIntentType =
  | 'discovery'
  | 'comparison'
  | 'purchase'
  | 'alternative'
  | 'local'
  | 'price'
  | 'review'
  | 'problem_solution';

export type OfferEntityType = 'own_brand' | 'competitor' | 'third_party' | 'unknown';
export type OfferSentiment = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';

export type OfferCategory = {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  type: OfferType;
  business_priority: OfferPriority | null;
  target_market: string | null;
  country: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OfferIntent = {
  id: string;
  offer_category_id: string;
  label: string;
  intent_type: OfferIntentType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OfferPrompt = {
  id: string;
  offer_category_id: string;
  offer_intent_id: string | null;
  prompt: string;
  language: string;
  country: string;
  ai_provider: string | null;
  is_active: boolean;
  source: 'generated' | 'manual' | 'imported';
  created_at: string;
  updated_at: string;
  intent?: Pick<OfferIntent, 'id' | 'label' | 'intent_type'> | null;
};

export type OfferPromptRun = {
  id: string;
  offer_prompt_id: string;
  offer_category_id: string;
  analysis_batch_id?: string | null;
  run_id: string | null;
  ai_provider: string;
  model: string | null;
  prompt: string;
  answer: string | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  raw_response: unknown;
  created_at: string;
  completed_at: string | null;
};

export type OfferMention = {
  id: string;
  offer_prompt_run_id: string;
  offer_category_id: string;
  entity_name: string;
  entity_type: OfferEntityType;
  matched_domain: string | null;
  position: number | null;
  is_recommended: boolean;
  sentiment: OfferSentiment | null;
  evidence_quote: string | null;
  confidence_score: number | null;
  created_at: string;
};

export type OfferCompetitorScore = {
  name: string;
  mentions: number;
  recommended_mentions: number;
  recommendation_rate: number | null;
  average_position: number | null;
  prompts: Array<{ id: string; prompt: string }>;
};

export type OfferScore = {
  prompts_tracked: number;
  total_runs: number;
  successful_runs: number;
  own_brand_mentioned_runs: number;
  own_brand_recommended_runs: number;
  own_brand_mentions: number;
  competitor_mentions: number;
  appearance_rate: number | null;
  recommendation_rate: number | null;
  average_position: number | null;
  category_share_of_voice: number | null;
  position_score: number;
  visibility_score: number | null;
  top_competitors: OfferCompetitorScore[];
  last_run_at: string | null;
  evolution_status: 'available' | 'insufficient_data';
};

export type OfferListItem = OfferCategory & {
  metrics: OfferScore;
};

export type OfferRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: OfferPriority;
  reason: string;
};

export type OfferDetail = {
  offer: OfferCategory;
  metrics: OfferScore;
  intents: OfferIntent[];
  prompts: OfferPrompt[];
  runs: Array<OfferPromptRun & { mentions: OfferMention[] }>;
  competitors: OfferCompetitorScore[];
  recommendations: OfferRecommendation[];
};

export type OfferVisibilityPlanUsage = {
  activeOffers: number;
  activePromptsForOffer?: number;
  offerRunsThisMonth?: number;
};

export type OfferCreateInput = {
  name: string;
  type: OfferType;
  description?: string | null;
  business_priority?: OfferPriority | null;
  target_market?: string | null;
  country?: string | null;
  language?: string | null;
  generate_prompts?: boolean;
};

export type OfferUpdateInput = Partial<Omit<OfferCreateInput, 'generate_prompts'>> & {
  is_active?: boolean;
};
