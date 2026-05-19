-- Migration: 012_domains_registry
-- Description: Domain classification for owned/competitor/third-party

CREATE TABLE IF NOT EXISTS public.domains_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'third_party', -- owned | competitor | third_party | unknown
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_registry_unique
  ON public.domains_registry(project_id, domain);

CREATE INDEX IF NOT EXISTS idx_domains_registry_project_id
  ON public.domains_registry(project_id);

ALTER TABLE public.sources_domains
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sources_domains_category ON public.sources_domains(category);

-- RLS
ALTER TABLE public.domains_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view domain registry of own projects" ON public.domains_registry;
DROP POLICY IF EXISTS "Users can insert domain registry to own projects" ON public.domains_registry;
DROP POLICY IF EXISTS "Users can update domain registry of own projects" ON public.domains_registry;
DROP POLICY IF EXISTS "Users can delete domain registry of own projects" ON public.domains_registry;

CREATE POLICY "Users can view domain registry of own projects" ON public.domains_registry
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = domains_registry.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert domain registry to own projects" ON public.domains_registry
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = domains_registry.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update domain registry of own projects" ON public.domains_registry
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = domains_registry.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete domain registry of own projects" ON public.domains_registry
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = domains_registry.project_id
      AND projects.user_id = auth.uid()
    )
  );
