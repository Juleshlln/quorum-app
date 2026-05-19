-- Migration: 0130_competitors_autodetect
-- Description: competitor metadata + suggestions + idempotence

ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_unique_domain
  ON public.competitors(project_id, domain)
  WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_unique_name
  ON public.competitors(project_id, lower(name));
CREATE TABLE IF NOT EXISTS public.competitor_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  domain TEXT,
  description TEXT,
  confidence NUMERIC,
  method TEXT,
  evidence JSONB,
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested | accepted | rejected
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_suggestions_unique_domain
  ON public.competitor_suggestions(project_id, domain)
  WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_suggestions_unique_name
  ON public.competitor_suggestions(project_id, lower(name));
ALTER TABLE public.competitor_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view competitor suggestions of own projects" ON public.competitor_suggestions;
DROP POLICY IF EXISTS "Users can insert competitor suggestions to own projects" ON public.competitor_suggestions;
DROP POLICY IF EXISTS "Users can update competitor suggestions of own projects" ON public.competitor_suggestions;
DROP POLICY IF EXISTS "Users can delete competitor suggestions of own projects" ON public.competitor_suggestions;
CREATE POLICY "Users can view competitor suggestions of own projects" ON public.competitor_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = competitor_suggestions.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert competitor suggestions to own projects" ON public.competitor_suggestions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = competitor_suggestions.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update competitor suggestions of own projects" ON public.competitor_suggestions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = competitor_suggestions.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete competitor suggestions of own projects" ON public.competitor_suggestions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = competitor_suggestions.project_id
      AND projects.user_id = auth.uid()
    )
  );
