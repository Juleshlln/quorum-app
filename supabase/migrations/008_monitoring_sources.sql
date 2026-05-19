-- Migration: 008_monitoring_sources
-- Description: Monitoring prompts/topics + sources citations + analysis kind

-- Extend analyses for scheduled vs sandbox
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'sandbox' NOT NULL,
  ADD COLUMN IF NOT EXISTS runs_per_prompt INTEGER DEFAULT 5 NOT NULL;
-- Monitoring topics
CREATE TABLE IF NOT EXISTS public.monitoring_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitoring_topics_project_id ON public.monitoring_topics(project_id);
-- Monitoring prompts (auto scheduled)
CREATE TABLE IF NOT EXISTS public.monitoring_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  source TEXT NOT NULL, -- custom | template
  template_id UUID NULL REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
  topic_id UUID NULL REFERENCES public.monitoring_topics(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_project_id ON public.monitoring_prompts(project_id);
-- Extend prompt_templates for objectives + monitoring defaults
ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS primary_objective TEXT,
  ADD COLUMN IF NOT EXISTS secondary_objectives TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS topic_slug TEXT,
  ADD COLUMN IF NOT EXISTS is_default_monitoring BOOLEAN DEFAULT false;
-- Extend analysis_runs for richer fields
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS response_text TEXT,
  ADD COLUMN IF NOT EXISTS brand_mentioned BOOLEAN,
  ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
  ADD COLUMN IF NOT EXISTS position_rank INTEGER;
-- Response citations
CREATE TABLE IF NOT EXISTS public.response_citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_run_id UUID NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_type TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_response_citations_run_id ON public.response_citations(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_response_citations_domain ON public.response_citations(domain);
-- Optional domain catalog
CREATE TABLE IF NOT EXISTS public.domains_catalog (
  domain TEXT PRIMARY KEY,
  domain_type TEXT DEFAULT 'other',
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
-- RLS
ALTER TABLE public.monitoring_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view monitoring topics of own projects" ON public.monitoring_topics;
DROP POLICY IF EXISTS "Users can insert monitoring topics to own projects" ON public.monitoring_topics;
DROP POLICY IF EXISTS "Users can update monitoring topics of own projects" ON public.monitoring_topics;
DROP POLICY IF EXISTS "Users can delete monitoring topics of own projects" ON public.monitoring_topics;
CREATE POLICY "Users can view monitoring topics of own projects" ON public.monitoring_topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_topics.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert monitoring topics to own projects" ON public.monitoring_topics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_topics.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update monitoring topics of own projects" ON public.monitoring_topics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_topics.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete monitoring topics of own projects" ON public.monitoring_topics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_topics.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view monitoring prompts of own projects" ON public.monitoring_prompts;
DROP POLICY IF EXISTS "Users can insert monitoring prompts to own projects" ON public.monitoring_prompts;
DROP POLICY IF EXISTS "Users can update monitoring prompts of own projects" ON public.monitoring_prompts;
DROP POLICY IF EXISTS "Users can delete monitoring prompts of own projects" ON public.monitoring_prompts;
CREATE POLICY "Users can view monitoring prompts of own projects" ON public.monitoring_prompts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompts.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert monitoring prompts to own projects" ON public.monitoring_prompts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompts.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update monitoring prompts of own projects" ON public.monitoring_prompts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompts.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete monitoring prompts of own projects" ON public.monitoring_prompts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompts.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view response citations of own projects" ON public.response_citations;
DROP POLICY IF EXISTS "Users can insert response citations to own projects" ON public.response_citations;
CREATE POLICY "Users can view response citations of own projects" ON public.response_citations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analysis_runs
      JOIN public.analyses ON analyses.id = analysis_runs.analysis_id
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analysis_runs.id = response_citations.analysis_run_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert response citations to own projects" ON public.response_citations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_runs
      JOIN public.analyses ON analyses.id = analysis_runs.analysis_id
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analysis_runs.id = response_citations.analysis_run_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view domains catalog" ON public.domains_catalog;
CREATE POLICY "Users can view domains catalog" ON public.domains_catalog
  FOR SELECT USING (true);
