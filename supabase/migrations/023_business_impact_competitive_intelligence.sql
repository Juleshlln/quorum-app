-- Migration: 023_business_impact_competitive_intelligence
-- Description: Business Impact & Competitive Intelligence data layer

CREATE TABLE IF NOT EXISTS public.analytics_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ga4', 'gsc', 'matomo')),
  credentials_encrypted TEXT,
  property_id TEXT,
  site_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_connections_unique
  ON public.analytics_connections(project_id, provider);

CREATE INDEX IF NOT EXISTS idx_analytics_connections_project
  ON public.analytics_connections(project_id, status);

CREATE TABLE IF NOT EXISTS public.traffic_daily_page_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.analytics_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'ga4' CHECK (provider IN ('ga4', 'gsc', 'matomo')),
  date DATE NOT NULL,
  page_url TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  sessions INTEGER NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  users INTEGER NOT NULL DEFAULT 0 CHECK (users >= 0),
  engaged_sessions INTEGER NOT NULL DEFAULT 0 CHECK (engaged_sessions >= 0),
  conversions NUMERIC NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  revenue NUMERIC NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_daily_page_metrics_unique
  ON public.traffic_daily_page_metrics(project_id, provider, date, page_url, source, medium) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_traffic_daily_page_metrics_project_date
  ON public.traffic_daily_page_metrics(project_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_traffic_daily_page_metrics_page
  ON public.traffic_daily_page_metrics(project_id, page_url);

CREATE TABLE IF NOT EXISTS public.ai_attribution_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  model TEXT,
  prompt_id UUID REFERENCES public.monitoring_prompts(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.monitoring_topics(id) ON DELETE SET NULL,
  cited_url TEXT NOT NULL,
  cited_domain TEXT,
  citation_count INTEGER NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
  visibility_score NUMERIC NOT NULL DEFAULT 0 CHECK (visibility_score >= 0),
  observed_ai_sessions INTEGER NOT NULL DEFAULT 0 CHECK (observed_ai_sessions >= 0),
  assisted_sessions_estimate NUMERIC NOT NULL DEFAULT 0 CHECK (assisted_sessions_estimate >= 0),
  conversions_observed NUMERIC NOT NULL DEFAULT 0 CHECK (conversions_observed >= 0),
  revenue_observed NUMERIC NOT NULL DEFAULT 0 CHECK (revenue_observed >= 0),
  attribution_confidence TEXT NOT NULL DEFAULT 'medium' CHECK (attribution_confidence IN ('low', 'medium', 'high')),
  attribution_version TEXT NOT NULL DEFAULT 'v1',
  source_detection_version TEXT NOT NULL DEFAULT 'ai-traffic-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_attribution_events_unique
  ON public.ai_attribution_events(project_id, date, model, prompt_id, topic_id, cited_url) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_ai_attribution_events_project_date
  ON public.ai_attribution_events(project_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_attribution_events_domain
  ON public.ai_attribution_events(project_id, cited_domain);

CREATE TABLE IF NOT EXISTS public.brand_search_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.analytics_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'gsc' CHECK (provider IN ('ga4', 'gsc', 'matomo')),
  date DATE NOT NULL,
  query TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  impressions INTEGER NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  ctr NUMERIC NOT NULL DEFAULT 0 CHECK (ctr >= 0),
  position NUMERIC NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_search_daily_unique
  ON public.brand_search_daily(project_id, provider, date, query);

CREATE INDEX IF NOT EXISTS idx_brand_search_daily_project_date
  ON public.brand_search_daily(project_id, date DESC);

ALTER TABLE public.analytics_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_daily_page_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_attribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_search_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view analytics connections of own projects" ON public.analytics_connections;
DROP POLICY IF EXISTS "Users can insert analytics connections to own projects" ON public.analytics_connections;
DROP POLICY IF EXISTS "Users can update analytics connections of own projects" ON public.analytics_connections;

CREATE POLICY "Users can view analytics connections of own projects" ON public.analytics_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = analytics_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analytics connections to own projects" ON public.analytics_connections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = analytics_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update analytics connections of own projects" ON public.analytics_connections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = analytics_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view traffic metrics of own projects" ON public.traffic_daily_page_metrics;
DROP POLICY IF EXISTS "Users can insert traffic metrics to own projects" ON public.traffic_daily_page_metrics;
DROP POLICY IF EXISTS "Users can update traffic metrics of own projects" ON public.traffic_daily_page_metrics;

CREATE POLICY "Users can view traffic metrics of own projects" ON public.traffic_daily_page_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = traffic_daily_page_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert traffic metrics to own projects" ON public.traffic_daily_page_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = traffic_daily_page_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update traffic metrics of own projects" ON public.traffic_daily_page_metrics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = traffic_daily_page_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view AI attribution events of own projects" ON public.ai_attribution_events;
DROP POLICY IF EXISTS "Users can insert AI attribution events to own projects" ON public.ai_attribution_events;
DROP POLICY IF EXISTS "Users can update AI attribution events of own projects" ON public.ai_attribution_events;

CREATE POLICY "Users can view AI attribution events of own projects" ON public.ai_attribution_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ai_attribution_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert AI attribution events to own projects" ON public.ai_attribution_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ai_attribution_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update AI attribution events of own projects" ON public.ai_attribution_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ai_attribution_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view brand search metrics of own projects" ON public.brand_search_daily;
DROP POLICY IF EXISTS "Users can insert brand search metrics to own projects" ON public.brand_search_daily;
DROP POLICY IF EXISTS "Users can update brand search metrics of own projects" ON public.brand_search_daily;

CREATE POLICY "Users can view brand search metrics of own projects" ON public.brand_search_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = brand_search_daily.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert brand search metrics to own projects" ON public.brand_search_daily
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = brand_search_daily.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update brand search metrics of own projects" ON public.brand_search_daily
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = brand_search_daily.project_id
      AND projects.user_id = auth.uid()
    )
  );
