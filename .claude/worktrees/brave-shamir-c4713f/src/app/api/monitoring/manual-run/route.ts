import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { createMonitoringRun, executeMonitoringRun } from '@/lib/monitoring/run-orchestrator';
import { logRun } from '@/lib/monitoring/run-logs';
import { getParisRunDate } from '@/lib/monitoring/run-date';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STALE_RUN_MINUTES = 30;

function isStaleRun(startedAt: string | null | undefined) {
  if (!startedAt) return true;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return true;
  return Date.now() - started > STALE_RUN_MINUTES * 60 * 1000;
}

export async function POST(_request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const supabase = createAdminClient();
  let monitoringRunId: string | null = null;
  const runDate = getParisRunDate();
  const startedAt = new Date().toISOString();

  const { data: existingRaw } = await supabase
    .from('monitoring_daily_runs')
    .select('id, status, started_at, monitoring_run_id')
    .eq('project_id', project.id)
    .eq('run_date', runDate)
    .maybeSingle();
  let existing = (existingRaw || null) as {
    id: string;
    status: string | null;
    started_at: string | null;
    monitoring_run_id: string | null;
  } | null;
  if (existing?.status === 'running' && isStaleRun(existing.started_at)) {
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
      projectId: project.id,
      level: 'error',
      step: 'manual_run',
      message: 'Run stale timeout',
      meta: { run_date: runDate, started_at: existing.started_at },
    });
    // Stale rows are closed and replaced by a fresh one.
    existing = null;
  }

  let runId = existing?.id || null;
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
    const { data: dailyRun } = await supabase
      .from('monitoring_daily_runs')
      .insert({
        project_id: project.id,
        run_date: runDate,
        status: 'running',
        started_at: startedAt,
      })
      .select('id')
      .single();
    runId = dailyRun?.id || null;
  }

  await logRun({
    supabase,
    runId,
    projectId: project.id,
    step: 'manual_run',
    message: 'Manual run started',
    meta: { run_date: runDate },
  });

  const runStart = Date.now();
  try {
    const { run } = await createMonitoringRun({
      supabase,
      projectId: project.id,
      windowDays: 30,
      createdBy: user.id,
      force: true,
    });
    monitoringRunId = run.id;

    const execution = await executeMonitoringRun({ supabase, runId: run.id });
    const summary = (execution as { summary?: { runs: number; answers: number } }).summary || { runs: 0, answers: 0 };

    const { data: runRow } = await supabase
      .from('monitoring_runs')
      .select('status, items_total, items_processed, items_success, items_failed')
      .eq('id', run.id)
      .maybeSingle();

    if (!runRow) {
      throw new Error(`Missing monitoring_runs row for run_id=${run.id}`);
    }

    await supabase
      .from('monitoring_daily_runs')
      .update({
        status: runRow.status || 'success',
        monitoring_run_id: run.id,
        items_total: runRow.items_total || 0,
        items_processed: runRow.items_processed || 0,
        items_success: runRow.items_success || 0,
        items_failed: runRow.items_failed || 0,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
      })
      .eq('id', runId);

    return NextResponse.json({ ok: true, skipped: false, run_id: run.id, ...summary });
  } catch (err: any) {
    const message = err?.message || String(err);
    await logRun({
      supabase,
      runId,
      projectId: project.id,
      level: 'error',
      step: 'manual_run',
      message,
      meta: { run_date: runDate },
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
