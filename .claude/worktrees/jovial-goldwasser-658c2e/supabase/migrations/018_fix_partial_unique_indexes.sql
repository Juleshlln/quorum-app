-- Migration: 018_fix_partial_unique_indexes
-- Description: Replace partial unique indexes with full unique constraints
-- so that Supabase upsert (ON CONFLICT) can resolve them properly.
-- Partial indexes (WHERE run_id IS NOT NULL) cannot be used by
-- PostgreSQL's ON CONFLICT clause, causing all upserts to fail silently.

-- 1. Fix prompt_runs: drop partial index, create full unique constraint
DROP INDEX IF EXISTS idx_prompt_runs_run_prompt_model;

-- Remove duplicate prompt_runs rows before adding constraint.
-- Keep the most recent row (by executed_at) for each (run_id, prompt_id, ai_model).
DELETE FROM public.prompt_runs a
  USING public.prompt_runs b
  WHERE a.run_id IS NOT NULL
    AND a.run_id = b.run_id
    AND a.prompt_id = b.prompt_id
    AND a.ai_model = b.ai_model
    AND a.id <> b.id
    AND a.executed_at < b.executed_at;

ALTER TABLE public.prompt_runs
  ADD CONSTRAINT uq_prompt_runs_run_prompt_model
  UNIQUE (run_id, prompt_id, ai_model);

-- 2. Fix citations: drop the partial index from migration 016.
-- The non-partial index idx_citations_unique_method from migration 011
-- on (project_id, prompt_run_id, url_id, method) already covers the
-- upsert in ingest.ts, so we just drop the conflicting partial one.
DROP INDEX IF EXISTS idx_citations_run_prompt_model_url_method;
