-- Migration: 017_citations_fallback_flag
-- Description: Flag heuristic fallback citations so KPI queries can exclude them

ALTER TABLE public.citations
  ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_citations_is_fallback
  ON public.citations(project_id, is_fallback, cited_at);

-- Backfill legacy heuristic rows produced by inferProbableSources fallback list
UPDATE public.citations c
SET is_fallback = true
FROM public.sources_urls su
WHERE c.url_id = su.id
  AND c.method = 'probable'
  AND (
    c.rationale ILIKE '%heuristique%'
    OR su.url IN (
      'https://wikipedia.org',
      'https://reddit.com',
      'https://youtube.com',
      'https://medium.com',
      'https://g2.com',
      'https://capterra.com',
      'https://trustpilot.com',
      'https://linkedin.com'
    )
  );
