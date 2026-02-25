-- Migration: 013_sources_runs_hardening
-- Description: Harden monitoring runs + normalize sources URLs/domains

-- Ensure sources tables exist (idempotent)
CREATE TABLE IF NOT EXISTS public.sources_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  domain_normalized TEXT,
  domain_type TEXT NOT NULL DEFAULT 'Other',
  is_owned BOOLEAN NOT NULL DEFAULT false,
  category TEXT,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sources_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.sources_domains(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_normalized TEXT,
  url_type TEXT NOT NULL DEFAULT 'Other',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Normalize sources fields
ALTER TABLE public.sources_domains
  ADD COLUMN IF NOT EXISTS domain_normalized TEXT;

ALTER TABLE public.sources_urls
  ADD COLUMN IF NOT EXISTS url_normalized TEXT;

UPDATE public.sources_domains
  SET domain_normalized = lower(regexp_replace(domain, '^www\.', ''))
  WHERE domain_normalized IS NULL AND domain IS NOT NULL;

UPDATE public.sources_urls
  SET url_normalized = url
  WHERE url_normalized IS NULL AND url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_domains_unique_normalized
  ON public.sources_domains(project_id, domain_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_urls_unique_normalized
  ON public.sources_urls(project_id, url_normalized);

CREATE INDEX IF NOT EXISTS idx_sources_domains_project_domain_normalized
  ON public.sources_domains(project_id, domain_normalized);

CREATE INDEX IF NOT EXISTS idx_sources_urls_project_url_normalized
  ON public.sources_urls(project_id, url_normalized);

-- Harden monitoring_daily_runs
ALTER TABLE public.monitoring_daily_runs
  ADD COLUMN IF NOT EXISTS items_processed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS error_stack TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

UPDATE public.monitoring_daily_runs
  SET status = 'success'
  WHERE status = 'completed';
