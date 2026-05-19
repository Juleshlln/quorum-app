-- Migration: 028_offer_visibility
-- Description: Offer Visibility module for product categories and services

CREATE TABLE IF NOT EXISTS public.offer_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  business_priority TEXT,
  target_market TEXT,
  country TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT offer_categories_type_check CHECK (type IN ('product_category', 'service')),
  CONSTRAINT offer_categories_priority_check CHECK (
    business_priority IS NULL OR business_priority IN ('high', 'medium', 'low')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_categories_project_name_type
  ON public.offer_categories(project_id, lower(name), type);
CREATE INDEX IF NOT EXISTS idx_offer_categories_project_active
  ON public.offer_categories(project_id, is_active, type, business_priority);

CREATE TABLE IF NOT EXISTS public.offer_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_category_id UUID NOT NULL REFERENCES public.offer_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT offer_intents_type_check CHECK (
    intent_type IN ('discovery', 'comparison', 'purchase', 'alternative', 'local', 'price', 'review', 'problem_solution')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_intents_offer_label_type
  ON public.offer_intents(offer_category_id, lower(label), intent_type);
CREATE INDEX IF NOT EXISTS idx_offer_intents_offer_active
  ON public.offer_intents(offer_category_id, is_active, intent_type);

CREATE TABLE IF NOT EXISTS public.offer_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_category_id UUID NOT NULL REFERENCES public.offer_categories(id) ON DELETE CASCADE,
  offer_intent_id UUID REFERENCES public.offer_intents(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  country TEXT NOT NULL DEFAULT 'France',
  ai_provider TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT offer_prompts_source_check CHECK (source IN ('generated', 'manual', 'imported'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_prompts_offer_prompt
  ON public.offer_prompts(offer_category_id, lower(prompt));
CREATE INDEX IF NOT EXISTS idx_offer_prompts_offer_active
  ON public.offer_prompts(offer_category_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.offer_prompt_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_prompt_id UUID NOT NULL REFERENCES public.offer_prompts(id) ON DELETE CASCADE,
  offer_category_id UUID NOT NULL REFERENCES public.offer_categories(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE SET NULL,
  ai_provider TEXT NOT NULL,
  model TEXT,
  prompt TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT offer_prompt_runs_status_check CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_offer_prompt_runs_offer_created
  ON public.offer_prompt_runs(offer_category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_prompt_runs_prompt_created
  ON public.offer_prompt_runs(offer_prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_prompt_runs_status
  ON public.offer_prompt_runs(status);

CREATE TABLE IF NOT EXISTS public.offer_visibility_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_prompt_run_id UUID NOT NULL REFERENCES public.offer_prompt_runs(id) ON DELETE CASCADE,
  offer_category_id UUID NOT NULL REFERENCES public.offer_categories(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  matched_domain TEXT,
  position INTEGER,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  sentiment TEXT,
  evidence_quote TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT offer_mentions_entity_type_check CHECK (entity_type IN ('own_brand', 'competitor', 'third_party', 'unknown')),
  CONSTRAINT offer_mentions_sentiment_check CHECK (
    sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed', 'unknown')
  ),
  CONSTRAINT offer_mentions_confidence_check CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_offer_mentions_run
  ON public.offer_visibility_mentions(offer_prompt_run_id);
CREATE INDEX IF NOT EXISTS idx_offer_mentions_offer_entity
  ON public.offer_visibility_mentions(offer_category_id, entity_type, lower(entity_name));

CREATE OR REPLACE VIEW public.offer_visibility_scores
WITH (security_invoker = true) AS
WITH successful_runs AS (
  SELECT *
  FROM public.offer_prompt_runs
  WHERE status = 'success'
),
run_mentions AS (
  SELECT
    r.offer_category_id,
    r.id AS run_id,
    BOOL_OR(m.entity_type = 'own_brand') AS own_brand_mentioned,
    BOOL_OR(m.entity_type = 'own_brand' AND m.is_recommended) AS own_brand_recommended,
    MIN(m.position) FILTER (WHERE m.entity_type = 'own_brand' AND m.position IS NOT NULL) AS own_brand_position
  FROM successful_runs r
  LEFT JOIN public.offer_visibility_mentions m ON m.offer_prompt_run_id = r.id
  GROUP BY r.offer_category_id, r.id
),
mention_counts AS (
  SELECT
    offer_category_id,
    COUNT(*) FILTER (WHERE entity_type = 'own_brand') AS own_brand_mentions,
    COUNT(*) FILTER (WHERE entity_type = 'competitor') AS competitor_mentions,
    COUNT(*) FILTER (WHERE entity_type IN ('own_brand', 'competitor')) AS total_brand_and_competitor_mentions
  FROM public.offer_visibility_mentions
  GROUP BY offer_category_id
),
top_competitors AS (
  SELECT
    offer_category_id,
    jsonb_agg(
      jsonb_build_object(
        'name', entity_name,
        'mentions', mentions,
        'recommended_mentions', recommended_mentions,
        'average_position', average_position
      )
      ORDER BY mentions DESC, entity_name ASC
    ) AS competitors
  FROM (
    SELECT
      offer_category_id,
      entity_name,
      COUNT(*) AS mentions,
      COUNT(*) FILTER (WHERE is_recommended) AS recommended_mentions,
      AVG(position) FILTER (WHERE position IS NOT NULL) AS average_position
    FROM public.offer_visibility_mentions
    WHERE entity_type = 'competitor'
    GROUP BY offer_category_id, entity_name
  ) ranked
  GROUP BY offer_category_id
),
prompt_counts AS (
  SELECT offer_category_id, COUNT(*) AS prompts_tracked
  FROM public.offer_prompts
  WHERE is_active = true
  GROUP BY offer_category_id
),
last_runs AS (
  SELECT offer_category_id, MAX(created_at) AS last_run_at
  FROM public.offer_prompt_runs
  GROUP BY offer_category_id
)
SELECT
  c.id AS offer_category_id,
  c.project_id,
  COALESCE(pc.prompts_tracked, 0)::INTEGER AS prompts_tracked,
  COUNT(rm.run_id)::INTEGER AS total_successful_runs,
  COALESCE((SELECT COUNT(*) FROM public.offer_prompt_runs r WHERE r.offer_category_id = c.id), 0)::INTEGER AS total_runs,
  COALESCE(COUNT(rm.run_id) FILTER (WHERE rm.own_brand_mentioned), 0)::INTEGER AS own_brand_mentioned_runs,
  COALESCE(COUNT(rm.run_id) FILTER (WHERE rm.own_brand_recommended), 0)::INTEGER AS own_brand_recommended_runs,
  COALESCE(mc.own_brand_mentions, 0)::INTEGER AS own_brand_mentions,
  COALESCE(mc.competitor_mentions, 0)::INTEGER AS competitor_mentions,
  CASE WHEN COUNT(rm.run_id) > 0
    THEN COUNT(rm.run_id) FILTER (WHERE rm.own_brand_mentioned)::NUMERIC / COUNT(rm.run_id)
    ELSE NULL
  END AS appearance_rate,
  CASE WHEN COUNT(rm.run_id) > 0
    THEN COUNT(rm.run_id) FILTER (WHERE rm.own_brand_recommended)::NUMERIC / COUNT(rm.run_id)
    ELSE NULL
  END AS recommendation_rate,
  AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) AS average_position,
  CASE WHEN COALESCE(mc.total_brand_and_competitor_mentions, 0) > 0
    THEN mc.own_brand_mentions::NUMERIC / mc.total_brand_and_competitor_mentions
    ELSE NULL
  END AS category_share_of_voice,
  CASE
    WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) IS NULL THEN 0
    WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 1 THEN 1.0
    WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 2 THEN 0.8
    WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 3 THEN 0.6
    WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 5 THEN 0.4
    ELSE 0.2
  END AS position_score,
  LEAST(100, GREATEST(0,
    COALESCE((CASE WHEN COUNT(rm.run_id) > 0
      THEN COUNT(rm.run_id) FILTER (WHERE rm.own_brand_mentioned)::NUMERIC / COUNT(rm.run_id)
      ELSE 0 END), 0) * 45
    + COALESCE((CASE WHEN COUNT(rm.run_id) > 0
      THEN COUNT(rm.run_id) FILTER (WHERE rm.own_brand_recommended)::NUMERIC / COUNT(rm.run_id)
      ELSE 0 END), 0) * 35
    + (CASE
      WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) IS NULL THEN 0
      WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 1 THEN 1.0
      WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 2 THEN 0.8
      WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 3 THEN 0.6
      WHEN AVG(rm.own_brand_position) FILTER (WHERE rm.own_brand_position IS NOT NULL) <= 5 THEN 0.4
      ELSE 0.2
    END) * 20
  )) AS visibility_score,
  COALESCE(tc.competitors, '[]'::jsonb) AS top_competitors,
  lr.last_run_at
FROM public.offer_categories c
LEFT JOIN run_mentions rm ON rm.offer_category_id = c.id
LEFT JOIN mention_counts mc ON mc.offer_category_id = c.id
LEFT JOIN top_competitors tc ON tc.offer_category_id = c.id
LEFT JOIN prompt_counts pc ON pc.offer_category_id = c.id
LEFT JOIN last_runs lr ON lr.offer_category_id = c.id
GROUP BY c.id, c.project_id, pc.prompts_tracked, mc.own_brand_mentions, mc.competitor_mentions,
  mc.total_brand_and_competitor_mentions, tc.competitors, lr.last_run_at;

ALTER TABLE public.offer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_prompt_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_visibility_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view offer categories of own projects" ON public.offer_categories;
DROP POLICY IF EXISTS "Users can insert offer categories to own projects" ON public.offer_categories;
DROP POLICY IF EXISTS "Users can update offer categories of own projects" ON public.offer_categories;
DROP POLICY IF EXISTS "Users can delete offer categories of own projects" ON public.offer_categories;

CREATE POLICY "Users can view offer categories of own projects" ON public.offer_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = offer_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert offer categories to own projects" ON public.offer_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = offer_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update offer categories of own projects" ON public.offer_categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = offer_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete offer categories of own projects" ON public.offer_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = offer_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage offer intents of own projects" ON public.offer_intents;
CREATE POLICY "Users can manage offer intents of own projects" ON public.offer_intents
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_intents.offer_category_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_intents.offer_category_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage offer prompts of own projects" ON public.offer_prompts;
CREATE POLICY "Users can manage offer prompts of own projects" ON public.offer_prompts
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_prompts.offer_category_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_prompts.offer_category_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage offer prompt runs of own projects" ON public.offer_prompt_runs;
CREATE POLICY "Users can manage offer prompt runs of own projects" ON public.offer_prompt_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_prompt_runs.offer_category_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_prompt_runs.offer_category_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage offer mentions of own projects" ON public.offer_visibility_mentions;
CREATE POLICY "Users can manage offer mentions of own projects" ON public.offer_visibility_mentions
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_visibility_mentions.offer_category_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.offer_categories
      JOIN public.projects ON projects.id = offer_categories.project_id
      WHERE offer_categories.id = offer_visibility_mentions.offer_category_id
      AND projects.user_id = auth.uid()
    )
  );
