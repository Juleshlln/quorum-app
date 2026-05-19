-- Migration: 031_product_prompt_foundation
-- Description: Add structured prompt metadata for product visibility without changing existing run behavior.

ALTER TABLE public.monitoring_prompts
  ADD COLUMN IF NOT EXISTS scope TEXT,
  ADD COLUMN IF NOT EXISTS quality_status TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT,
  ADD COLUMN IF NOT EXISTS prompt_origin TEXT,
  ADD COLUMN IF NOT EXISTS rationale TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'fr-FR';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS use_case TEXT,
  ADD COLUMN IF NOT EXISTS target_customer TEXT;

UPDATE public.monitoring_prompts
SET
  prompt_origin = COALESCE(prompt_origin, 'radar'),
  scope = COALESCE(scope, CASE WHEN category_id IS NOT NULL THEN 'category' ELSE 'brand' END),
  lifecycle_status = COALESCE(
    lifecycle_status,
    CASE
      WHEN is_active = false THEN 'paused'
      ELSE 'active'
    END
  ),
  quality_status = COALESCE(quality_status, 'needs_review'),
  locale = COALESCE(locale, 'fr-FR');

UPDATE public.monitoring_prompts
SET intent = CASE
  WHEN intent IS NULL AND buying_intent IS NOT NULL THEN
    CASE
      WHEN buying_intent IN ('discovery', 'comparison', 'purchase', 'use_case', 'specification', 'brand', 'category', 'competitive') THEN buying_intent
      WHEN buying_intent IN ('decision', 'achat') THEN 'purchase'
      WHEN buying_intent IN ('attribute-based', 'attribute_based') THEN 'specification'
      ELSE 'discovery'
    END
  WHEN intent IS NULL THEN
    CASE
      WHEN scope = 'category' THEN 'category'
      ELSE 'brand'
    END
  WHEN intent IN ('information', 'recommendation') THEN 'discovery'
  WHEN intent IN ('decision', 'achat') THEN 'purchase'
  WHEN intent IN ('attribute-based', 'attribute_based') THEN 'specification'
  WHEN intent NOT IN ('discovery', 'comparison', 'purchase', 'use_case', 'specification', 'brand', 'category', 'competitive') THEN 'discovery'
  ELSE intent
END;

ALTER TABLE public.monitoring_prompts
  ALTER COLUMN prompt_origin SET DEFAULT 'radar',
  ALTER COLUMN scope SET DEFAULT 'brand',
  ALTER COLUMN lifecycle_status SET DEFAULT 'active',
  ALTER COLUMN quality_status SET DEFAULT 'needs_review',
  ALTER COLUMN locale SET DEFAULT 'fr-FR';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitoring_prompts_scope_check'
      AND conrelid = 'public.monitoring_prompts'::regclass
  ) THEN
    ALTER TABLE public.monitoring_prompts
      ADD CONSTRAINT monitoring_prompts_scope_check
      CHECK (scope IS NULL OR scope IN ('brand', 'category', 'product', 'competitive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitoring_prompts_intent_structured_check'
      AND conrelid = 'public.monitoring_prompts'::regclass
  ) THEN
    ALTER TABLE public.monitoring_prompts
      ADD CONSTRAINT monitoring_prompts_intent_structured_check
      CHECK (intent IS NULL OR intent IN ('discovery', 'comparison', 'purchase', 'use_case', 'specification', 'brand', 'category', 'competitive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitoring_prompts_quality_status_check'
      AND conrelid = 'public.monitoring_prompts'::regclass
  ) THEN
    ALTER TABLE public.monitoring_prompts
      ADD CONSTRAINT monitoring_prompts_quality_status_check
      CHECK (quality_status IS NULL OR quality_status IN ('valid', 'needs_review', 'too_generic', 'too_biased', 'missing_product_context'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitoring_prompts_lifecycle_status_check'
      AND conrelid = 'public.monitoring_prompts'::regclass
  ) THEN
    ALTER TABLE public.monitoring_prompts
      ADD CONSTRAINT monitoring_prompts_lifecycle_status_check
      CHECK (lifecycle_status IS NULL OR lifecycle_status IN ('draft', 'validated', 'active', 'paused', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitoring_prompts_prompt_origin_check'
      AND conrelid = 'public.monitoring_prompts'::regclass
  ) THEN
    ALTER TABLE public.monitoring_prompts
      ADD CONSTRAINT monitoring_prompts_prompt_origin_check
      CHECK (prompt_origin IS NULL OR prompt_origin IN ('radar', 'product_visibility', 'offer_visibility', 'manual', 'generated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_product_foundation
  ON public.monitoring_prompts(project_id, prompt_origin, scope, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_quality_status
  ON public.monitoring_prompts(project_id, quality_status);

CREATE TABLE IF NOT EXISTS public.monitoring_prompt_competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.monitoring_prompts(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, competitor_id)
);

CREATE INDEX IF NOT EXISTS idx_monitoring_prompt_competitors_prompt
  ON public.monitoring_prompt_competitors(prompt_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompt_competitors_competitor
  ON public.monitoring_prompt_competitors(competitor_id);

CREATE TABLE IF NOT EXISTS public.monitoring_prompt_engines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.monitoring_prompts(id) ON DELETE CASCADE,
  engine TEXT NOT NULL,
  model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, engine)
);

ALTER TABLE public.monitoring_prompt_engines
  ALTER COLUMN engine SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitoring_prompt_engines_engine_check'
      AND conrelid = 'public.monitoring_prompt_engines'::regclass
  ) THEN
    ALTER TABLE public.monitoring_prompt_engines
      ADD CONSTRAINT monitoring_prompt_engines_engine_check
      CHECK (engine IN ('chatgpt', 'claude', 'gemini', 'perplexity', 'llama', 'grok', 'deepseek', 'openai', 'anthropic', 'google'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitoring_prompt_engines_prompt
  ON public.monitoring_prompt_engines(prompt_id, is_active);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompt_engines_engine
  ON public.monitoring_prompt_engines(engine, is_active);

ALTER TABLE public.monitoring_prompt_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_prompt_engines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage monitoring prompt competitors of own projects" ON public.monitoring_prompt_competitors;
CREATE POLICY "Users can manage monitoring prompt competitors of own projects" ON public.monitoring_prompt_competitors
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.monitoring_prompts
      JOIN public.projects ON projects.id = monitoring_prompts.project_id
      WHERE monitoring_prompts.id = monitoring_prompt_competitors.prompt_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.monitoring_prompts
      JOIN public.projects ON projects.id = monitoring_prompts.project_id
      WHERE monitoring_prompts.id = monitoring_prompt_competitors.prompt_id
        AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage monitoring prompt engines of own projects" ON public.monitoring_prompt_engines;
CREATE POLICY "Users can manage monitoring prompt engines of own projects" ON public.monitoring_prompt_engines
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.monitoring_prompts
      JOIN public.projects ON projects.id = monitoring_prompts.project_id
      WHERE monitoring_prompts.id = monitoring_prompt_engines.prompt_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.monitoring_prompts
      JOIN public.projects ON projects.id = monitoring_prompts.project_id
      WHERE monitoring_prompts.id = monitoring_prompt_engines.prompt_id
        AND projects.user_id = auth.uid()
    )
  );
