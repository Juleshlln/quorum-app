import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { createMonitoringRun, executeMonitoringRun, isValidCompletedRun } from '@/lib/monitoring/run-orchestrator';
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
  console.log('[monitoring/manual-run] POST called', {
    timestamp: new Date().toISOString(),
  });

  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  console.log('[monitoring/manual-run] auth', { user_id: user?.id ?? null });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  console.log('[monitoring/manual-run] active project', { project_id: project?.id ?? null });
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const runDate = getParisRunDate();
  const startedAt = new Date().toISOString();

  const { data: existingRaw } = await supabase
    .from('monitoring_daily_runs')
    .select('id, status, started_at')
    .eq('project_id', project.id)
    .eq('run_date', runDate)
    .maybeSingle();
  const existing = (existingRaw || null) as { id: string; status: string | null; started_at: string | null } | null;
  console.log('[monitoring/manual-run] daily_run check', {
    run_date: runDate,
    existing_id: existing?.id ?? null,
    existing_status: existing?.status ?? null,
  });

  if (existing?.status === 'success') {
    // Validate the corresponding monitoring_run actually has data
    const { data: linkedRun } = await supabase
      .from('monitoring_runs')
      .select('id')
      .eq('project_id', project.id)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (linkedRun) {
      const validation = await isValidCompletedRun(supabase, linkedRun.id);
      if (validation.valid) {
        console.log('[monitoring/manual-run] skipped: valid monitoring_run exists', { run_id: linkedRun.id });
        return NextResponse.json({ ok: true, skipped: true, status: existing.status });
      }
      await logRun({
        supabase,
        runId: existing.id,
        projectId: project.id,
        level: 'warn',
        step: 'manual_run',
        message: 'Daily run was success but monitoring_run is invalid; re-running',
        meta: { items_total: validation.itemsTotal, prompt_runs: validation.linkedPromptRuns },
      });
      // Fall through to re-run
    } else {
      console.log('[monitoring/manual-run] daily_run is success but no monitoring_run in success found; re-running');
      await logRun({
        supabase,
        runId: existing.id,
        projectId: project.id,
        level: 'warn',
        step: 'manual_run',
        message: 'Daily run was success but no monitoring_run in success status found; re-running',
      });
      // Fall through to re-run
    }
  }
  if (existing?.status === 'running') {
    if (!isStaleRun(existing.started_at)) {
      return NextResponse.json({ ok: true, skipped: true, status: existing.status });
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
      projectId: project.id,
      level: 'error',
      step: 'manual_run',
      message: 'Run stale timeout',
      meta: { run_date: runDate, started_at: existing.started_at },
    });
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
    const { run, reused } = await createMonitoringRun({
      supabase,
      projectId: project.id,
      windowDays: 30,
      createdBy: user.id,
      force: true,
    });
    console.log('[monitoring/manual-run] monitoring_run', {
      monitoring_run_id: run.id,
      status: run.status,
      reused,
      items_total: run.items_total,
    });

    const execution = await executeMonitoringRun({ supabase, runId: run.id });
    console.log('[monitoring/manual-run] execution result', {
      skipped: !!execution.skipped,
      ok: (execution as any).ok,
      status: (execution as any).status,
    });
    if (execution.skipped) {
      await supabase
        .from('monitoring_daily_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - runStart,
        })
        .eq('id', runId);
      return NextResponse.json({ ok: true, skipped: true, status: 'success' });
    }
    const summary = (execution as { summary?: { runs: number; answers: number } }).summary || { runs: 0, answers: 0 };

    const { data: runRow } = await supabase
      .from('monitoring_runs')
      .select('status, items_total, items_processed, items_success, items_failed')
      .eq('id', run.id)
      .maybeSingle();

    await supabase
      .from('monitoring_daily_runs')
      .update({
        status: runRow?.status || 'success',
        items_total: runRow?.items_total || 0,
        items_processed: runRow?.items_processed || 0,
        items_success: runRow?.items_success || 0,
        items_failed: runRow?.items_failed || 0,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
      })
      .eq('id', runId);

    return NextResponse.json({ ok: true, ...summary });
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
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
        error_message: message,
        error_stack: err?.stack || null,
      })
      .eq('id', runId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
