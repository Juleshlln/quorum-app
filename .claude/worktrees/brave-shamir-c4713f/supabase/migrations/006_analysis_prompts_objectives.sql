-- Migration: 006_analysis_prompts_objectives
-- Description: Add objective tagging metadata to analysis_prompts

ALTER TABLE public.analysis_prompts
  ADD COLUMN IF NOT EXISTS objective_tag TEXT,
  ADD COLUMN IF NOT EXISTS template_id TEXT;
