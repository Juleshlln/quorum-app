-- Migration: 021_daily_runs_monitoring_run_fk
-- Goal: enforce traceability between monitoring_daily_runs and monitoring_runs

ALTER TABLE public.monitoring_daily_runs
  ADD COLUMN IF NOT EXISTS monitoring_run_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'monitoring_daily_runs_monitoring_run_id_fkey'
  ) THEN
    ALTER TABLE public.monitoring_daily_runs
      ADD CONSTRAINT monitoring_daily_runs_monitoring_run_id_fkey
      FOREIGN KEY (monitoring_run_id)
      REFERENCES public.monitoring_runs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitoring_daily_runs_monitoring_run_id
  ON public.monitoring_daily_runs(monitoring_run_id);

-- Best-effort backfill for existing rows:
-- match by same project + same run date (run_date/window_end/created_at::date)
UPDATE public.monitoring_daily_runs d
SET monitoring_run_id = (
  SELECT mr.id
  FROM public.monitoring_runs mr
  WHERE mr.project_id = d.project_id
    AND (
      mr.run_date = d.run_date
      OR mr.window_end = d.run_date
      OR mr.created_at::date = d.run_date
    )
  ORDER BY mr.created_at DESC
  LIMIT 1
)
WHERE d.monitoring_run_id IS NULL;

-- New writes only: success/partial rows must point to a monitoring run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_daily_status_requires_monitoring_run'
  ) THEN
    ALTER TABLE public.monitoring_daily_runs
      ADD CONSTRAINT ck_daily_status_requires_monitoring_run
      CHECK (
        status NOT IN ('success', 'partial')
        OR monitoring_run_id IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

-- New writes only: counters must stay coherent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_daily_items_consistent'
  ) THEN
    ALTER TABLE public.monitoring_daily_runs
      ADD CONSTRAINT ck_daily_items_consistent
      CHECK (
        items_total >= 0
        AND items_success >= 0
        AND items_failed >= 0
        AND COALESCE(items_processed, 0) >= 0
        AND (items_success + items_failed) <= GREATEST(items_total, COALESCE(items_processed, 0))
      ) NOT VALID;
  END IF;
END $$;
