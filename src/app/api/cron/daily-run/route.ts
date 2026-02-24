import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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

  const { data: promptProjects } = await supabase
    .from('monitoring_prompts')
    .select('project_id')
    .eq('is_active', true);

  const projectIds = Array.from(new Set((promptProjects || []).map((p: any) => p.project_id))) as string[];

  const results: Array<{ project_id: string; runs: number; answers: number; skipped?: boolean }> = [];

  for (const projectId of projectIds) {
    const startedAt = new Date().toISOString();
    const { data: existingRaw } = await supabase
      .from('monitoring_daily_runs')
      .select('id, status, started_at')
      .eq('project_id', projectId)
      .eq('run_date', runDate)
      .maybeSingle();
    const existing = (existingRaw || null) as { id: string; status: string | null; started_at: string | null } | null;

    if (existing?.status === 'success') {
      // Validate the corresponding monitoring_run actually has data
      const { data: linkedRun } = await supabase
        .from('monitoring_runs')
        .select('id')
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
        results.push({ project_id: projectId, runs: 0, answers: 0, skipped: true });
        continue;
      }
    }
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
          project_id: projectId,
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
      projectId,
      step: 'create_run',
      message: 'Daily run started',
      meta: { run_date: runDate },
    });

    const runStart = Date.now();
    try {
      const { run } = await createMonitoringRun({
        supabase,
        projectId,
        windowDays: 30,
        createdBy: null,
      });

      const execution = await executeMonitoringRun({ supabase, runId: run.id });
      if (execution.skipped) {
        await supabase
          .from('monitoring_daily_runs')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - runStart,
          })
          .eq('id', runId);
        results.push({ project_id: projectId, runs: 0, answers: 0, skipped: true });
        continue;
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

      results.push({ project_id: projectId, ...summary });
    } catch (err: any) {
      const message = err?.message || String(err);
      await logRun({
        supabase,
        runId,
        projectId,
        level: 'error',
        step: 'daily_run',
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
      results.push({ project_id: projectId, runs: 0, answers: 0 });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: NextRequest) {
  return handleDailyRun(request);
}

export async function GET(request: NextRequest) {
  return handleDailyRun(request);
}
