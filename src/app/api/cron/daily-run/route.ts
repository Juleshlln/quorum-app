import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createMonitoringRun, executeMonitoringRun, isValidCompletedRun } from '@/lib/monitoring/run-orchestrator';
import { logRun } from '@/lib/monitoring/run-logs';
import { getParisRunDate } from '@/lib/monitoring/run-date';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STALE_RUN_MINUTES = 15;

function isStaleRun(startedAt: string | null | undefined) {
  if (!startedAt) return true;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return true;
  return Date.now() - started > STALE_RUN_MINUTES * 60 * 1000;
}

/* ------------------------------------------------------------------ */
/*  Step 1: Auto-recover ALL stuck runs across all projects/dates     */
/* ------------------------------------------------------------------ */
async function recoverStuckRuns(supabase: ReturnType<typeof createAdminClient>) {
  const { data: stuckRuns } = await supabase
    .from('monitoring_daily_runs')
    .select('id, project_id, run_date, started_at')
    .eq('status', 'running');

  let recovered = 0;
  for (const run of stuckRuns || []) {
    if (!isStaleRun(run.started_at)) continue;

    await supabase
      .from('monitoring_daily_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: `Auto-recovery: run bloqué depuis > ${STALE_RUN_MINUTES} min`,
      })
      .eq('id', run.id);

    await logRun({
      supabase,
      runId: run.id,
      projectId: run.project_id,
      level: 'error',
      step: 'auto_recovery',
      message: `Stuck run auto-recovered after ${STALE_RUN_MINUTES}min timeout`,
      meta: { run_date: run.run_date, started_at: run.started_at },
    });

    recovered++;
  }

  // Also recover stuck monitoring_runs (execution level)
  const { data: stuckMonitoringRuns } = await supabase
    .from('monitoring_runs')
    .select('id, project_id, started_at')
    .eq('status', 'running');

  for (const run of stuckMonitoringRuns || []) {
    if (!isStaleRun(run.started_at)) continue;

    await supabase
      .from('monitoring_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: `Auto-recovery: run bloqué depuis > ${STALE_RUN_MINUTES} min`,
      })
      .eq('id', run.id);

    recovered++;
  }

  return recovered;
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */
async function handleDailyRun(request: NextRequest) {
  const cronHeader = request.headers.get('x-vercel-cron');
  const authHeader = request.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '');

  const isVercelCron = cronHeader === '1';
  const isValidSecret = process.env.CRON_SECRET && secret === process.env.CRON_SECRET;

  if (!isVercelCron && !isValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const runDate = getParisRunDate();

  // --- Step 1: Auto-recover stuck runs BEFORE anything else ---
  const recoveredCount = await recoverStuckRuns(supabase);

  const { data: promptProjects } = await supabase
    .from('monitoring_prompts')
    .select('project_id')
    .eq('is_active', true);

  const projectIds = Array.from(new Set((promptProjects || []).map((p: any) => p.project_id))) as string[];

  const results: Array<{ project_id: string; runs: number; answers: number; skipped?: boolean; error?: string }> = [];

  for (const projectId of projectIds) {
    let monitoringRunId: string | null = null;
    let runId: string | null = null;
    const startedAt = new Date().toISOString();

    // --- Step A: Check for existing daily run ---
    let existing: {
      id: string;
      status: string | null;
      started_at: string | null;
      monitoring_run_id: string | null;
    } | null = null;

    try {
      const { data: existingRaw } = await supabase
        .from('monitoring_daily_runs')
        .select('id, status, started_at, monitoring_run_id')
        .eq('project_id', projectId)
        .eq('run_date', runDate)
        .maybeSingle();
      existing = existingRaw || null;
    } catch (err: any) {
      await logRun({
        supabase,
        runId: null,
        projectId,
        level: 'error',
        step: 'fetch_existing',
        message: `Failed to fetch existing daily run: ${err?.message || err}`,
        meta: { run_date: runDate },
      });
    }

    // --- Step B: Handle already-successful runs ---
    if (existing?.status === 'success') {
      const { data: linkedRun } = await supabase
        .from('monitoring_runs')
        .select('id, status, items_total, items_processed, items_success, items_failed')
        .eq('project_id', projectId)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let skipValid = false;
      if (linkedRun) {
        const validation = await isValidCompletedRun(supabase, linkedRun.id);
        if (validation.valid) {
          skipValid = true;
          monitoringRunId = linkedRun.id;
        } else {
          await logRun({
            supabase,
            runId: existing.id,
            projectId,
            level: 'warn',
            step: 'daily_run',
            message: 'Daily run was success but monitoring_run is invalid; re-running',
            meta: { items_total: validation.itemsTotal, prompt_runs: validation.linkedPromptRuns },
          });
        }
      } else {
        await logRun({
          supabase,
          runId: existing.id,
          projectId,
          level: 'warn',
          step: 'daily_run',
          message: 'Daily run was success but no monitoring_run in success status found; re-running',
        });
      }
      if (skipValid) {
        await supabase
          .from('monitoring_daily_runs')
          .update({
            monitoring_run_id: monitoringRunId,
            items_total: linkedRun?.items_total || 0,
            items_processed: linkedRun?.items_processed || 0,
            items_success: linkedRun?.items_success || 0,
            items_failed: linkedRun?.items_failed || 0,
          })
          .eq('id', existing.id);
        results.push({ project_id: projectId, runs: 0, answers: 0, skipped: true });
        continue;
      }
    }

    // --- Step C: Handle still-running runs (should be recovered above, but double-check) ---
    if (existing?.status === 'running') {
      if (!isStaleRun(existing.started_at)) {
        results.push({ project_id: projectId, runs: 0, answers: 0, skipped: true });
        continue;
      }
      await supabase
        .from('monitoring_daily_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: `Run bloqué (> ${STALE_RUN_MINUTES} min)`,
        })
        .eq('id', existing.id);
      await logRun({
        supabase,
        runId: existing.id,
        projectId,
        level: 'error',
        step: 'daily_run',
        message: 'Run stale timeout',
        meta: { run_date: runDate, started_at: existing.started_at },
      });
      existing = null;
    }

    // --- Step D: Create or reuse daily_runs row ---
    try {
      runId = existing?.id || null;
      if (runId) {
        await supabase
          .from('monitoring_daily_runs')
          .update({
            status: 'running',
            started_at: startedAt,
            finished_at: null,
            error_message: null,
            error_stack: null,
          })
          .eq('id', runId);
      } else {
        const { data: dailyRun, error: insertErr } = await supabase
          .from('monitoring_daily_runs')
          .insert({
            project_id: projectId,
            run_date: runDate,
            status: 'running',
            started_at: startedAt,
          })
          .select('id')
          .single();
        if (insertErr) throw new Error(`Insert monitoring_daily_runs failed: ${insertErr.message}`);
        runId = dailyRun?.id || null;
      }
    } catch (err: any) {
      const message = `Failed to create daily_runs row: ${err?.message || err}`;
      await logRun({
        supabase,
        runId: null,
        projectId,
        level: 'error',
        step: 'create_daily_run',
        message,
        meta: { run_date: runDate },
      });
      results.push({ project_id: projectId, runs: 0, answers: 0, error: message });
      continue;
    }

    await logRun({
      supabase,
      runId,
      projectId,
      step: 'create_run',
      message: 'Daily run started',
      meta: { run_date: runDate },
    });

    const runStart = Date.now();

    // --- Step E: Create monitoring run ---
    try {
      const { run } = await createMonitoringRun({
        supabase,
        projectId,
        windowDays: 30,
        createdBy: null,
      });
      monitoringRunId = run.id;

      // Immediately link the monitoring_run_id so it's never NULL even if execution crashes
      await supabase
        .from('monitoring_daily_runs')
        .update({ monitoring_run_id: run.id })
        .eq('id', runId);

      await logRun({
        supabase,
        runId,
        monitoringRunId,
        projectId,
        step: 'create_monitoring_run',
        message: `Monitoring run created: ${run.id}`,
      });
    } catch (err: any) {
      const message = `createMonitoringRun failed: ${err?.message || err}`;
      await logRun({
        supabase,
        runId,
        projectId,
        level: 'error',
        step: 'create_monitoring_run',
        message,
        meta: { run_date: runDate, stack: err?.stack },
      });
      await supabase
        .from('monitoring_daily_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - runStart,
          error_message: message,
          error_stack: err?.stack || null,
        })
        .eq('id', runId);
      results.push({ project_id: projectId, runs: 0, answers: 0, error: message });
      continue;
    }

    // --- Step F: Execute monitoring run ---
    try {
      const execution = await executeMonitoringRun({ supabase, runId: monitoringRunId! });

      if (execution.skipped) {
        const { data: skippedRunRow } = await supabase
          .from('monitoring_runs')
          .select('status, items_total, items_processed, items_success, items_failed')
          .eq('id', monitoringRunId)
          .maybeSingle();

        await supabase
          .from('monitoring_daily_runs')
          .update({
            status: skippedRunRow?.status === 'partial' ? 'partial' : 'success',
            monitoring_run_id: monitoringRunId,
            items_total: skippedRunRow?.items_total || 0,
            items_processed: skippedRunRow?.items_processed || 0,
            items_success: skippedRunRow?.items_success || 0,
            items_failed: skippedRunRow?.items_failed || 0,
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - runStart,
          })
          .eq('id', runId);

        await logRun({
          supabase,
          runId,
          monitoringRunId,
          projectId,
          step: 'execute_run',
          message: 'Execution skipped (already completed)',
        });

        results.push({ project_id: projectId, runs: 0, answers: 0, skipped: true });
        continue;
      }

      const summary = (execution as { summary?: { runs: number; answers: number } }).summary || { runs: 0, answers: 0 };

      const { data: runRow } = await supabase
        .from('monitoring_runs')
        .select('status, items_total, items_processed, items_success, items_failed')
        .eq('id', monitoringRunId)
        .maybeSingle();

      if (!runRow) {
        throw new Error(`Missing monitoring_runs row for run_id=${monitoringRunId}`);
      }

      await supabase
        .from('monitoring_daily_runs')
        .update({
          status: runRow.status || 'success',
          monitoring_run_id: monitoringRunId,
          items_total: runRow.items_total || 0,
          items_processed: runRow.items_processed || 0,
          items_success: runRow.items_success || 0,
          items_failed: runRow.items_failed || 0,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - runStart,
        })
        .eq('id', runId);

      await logRun({
        supabase,
        runId,
        monitoringRunId,
        projectId,
        step: 'execute_run',
        message: `Execution completed: ${summary.runs} runs, ${summary.answers} answers`,
        meta: { status: runRow.status, items_total: runRow.items_total },
      });

      results.push({ project_id: projectId, ...summary });
    } catch (err: any) {
      const message = `executeMonitoringRun failed: ${err?.message || err}`;
      await logRun({
        supabase,
        runId,
        monitoringRunId,
        projectId,
        level: 'error',
        step: 'execute_run',
        message,
        meta: { run_date: runDate, stack: err?.stack },
      });
      await supabase
        .from('monitoring_daily_runs')
        .update({
          status: 'failed',
          monitoring_run_id: monitoringRunId,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - runStart,
          error_message: message,
          error_stack: err?.stack || null,
        })
        .eq('id', runId);
      results.push({ project_id: projectId, runs: 0, answers: 0, error: message });
    }
  }

  return NextResponse.json({ ok: true, recovered: recoveredCount, results });
}

export async function POST(request: NextRequest) {
  return handleDailyRun(request);
}

export async function GET(request: NextRequest) {
  return handleDailyRun(request);
}
