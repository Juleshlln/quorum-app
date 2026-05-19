-- Migration: 024_business_impact_refinements
-- Description: Add upper bound on visibility_score, index on connection_id, DELETE policies

-- Bound visibility_score to 0-100 range
ALTER TABLE public.ai_attribution_events
  DROP CONSTRAINT IF EXISTS ai_attribution_events_visibility_score_check,
  ADD CONSTRAINT ai_attribution_events_visibility_score_check
    CHECK (visibility_score >= 0 AND visibility_score <= 100);

-- Add index on connection_id for traffic metrics lookups by connection
CREATE INDEX IF NOT EXISTS idx_traffic_daily_page_metrics_connection
  ON public.traffic_daily_page_metrics(connection_id);

-- Add DELETE policies (allows users to clean up their own project data)
CREATE POLICY "Users can delete analytics connections of own projects" ON public.analytics_connections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = analytics_connections.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete traffic metrics of own projects" ON public.traffic_daily_page_metrics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = traffic_daily_page_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete AI attribution events of own projects" ON public.ai_attribution_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ai_attribution_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete brand search metrics of own projects" ON public.brand_search_daily
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = brand_search_daily.project_id
      AND projects.user_id = auth.uid()
    )
  );
