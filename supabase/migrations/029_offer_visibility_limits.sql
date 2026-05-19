-- Migration: 029_offer_visibility_limits
-- Description: Plan limits support for Offer Visibility runs

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_plan_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('starter', 'pro', 'enterprise'));
  END IF;
END $$;

ALTER TABLE public.offer_prompt_runs
  ADD COLUMN IF NOT EXISTS analysis_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_offer_prompt_runs_analysis_batch
  ON public.offer_prompt_runs(analysis_batch_id);

CREATE INDEX IF NOT EXISTS idx_offer_prompt_runs_monthly_quota
  ON public.offer_prompt_runs(offer_category_id, created_at DESC, analysis_batch_id);
