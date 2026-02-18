import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runMonitoringForProject } from '@/lib/monitoring/run-monitoring';
import { logRun } from '@/lib/monitoring/run-logs';
import { getParisRunDate } from '@/lib/monitoring/run-date';

export const runtime = 'nodejs';

const STALE_RUN_MINUTES = 30;

function isStaleRun(startedAt: string | null | undefined) {
  if (!startedAt) return true;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return true;
  return Date.now() - started > STALE_RUN_MINUTES * 60 * 1000;
}

function buildContext(project: any) {
  const contextParts: string[] = [];
  if (project.description) contextParts.push(project.description);
  if (project.location) contextParts.push(`Localisation: ${project.location}`);
  if (project.industry) contextParts.push(`Secteur: ${project.industry}`);
  if (Array.isArray(project.keywords) && project.keywords.length > 0) {
    contextParts.push(`Mots-clés: ${project.keywords.join(', ')}`);
  }
  return contextParts.length > 0 ? `Contexte de la marque: ${contextParts.join('. ')}.` : '';
}

async function handleDailyRun(request: NextRequest) {
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const querySecret = new URL(request.url).searchParams.get('secret');
  const secret = headerSecret || bearerToken || querySecret;
  if (process.env.CRON_SECRET) {
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (!request.headers.get('x-vercel-cron')) {
    return NextResponse.json({ error: 'CRON_SECRET missing' }, { status: 500 });
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
      results.push({ project_id: projectId, runs: 0, answers: 0, skipped: true });
      continue;
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
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, description, location, industry, keywords')
        .eq('id', projectId)
        .single();

      if (!project) {
        throw new Error('Project not found');
      }

      const { data: competitorsRows } = await supabase
        .from('competitors')
        .select('name')
        .eq('project_id', projectId);
      const competitors = (competitorsRows || []).map((row: { name: string }) => row.name);

      const context = buildContext(project);

      const { count: promptsCount } = await supabase
        .from('monitoring_prompts')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('is_active', true);

      const itemsTotal = (promptsCount || 0) * 1;

      const summary = await runMonitoringForProject({
        supabase,
        runId,
        projectId,
        brandName: project.name,
        competitors,
        context,
        runType: 'monitoring',
        scheduledAt: startedAt,
      });

      const itemsFailed = Math.max(0, itemsTotal - summary.runs);
      const status = itemsFailed > 0 ? 'partial' : 'success';

      await supabase
        .from('monitoring_daily_runs')
        .update({
          status,
          items_total: itemsTotal,
          items_processed: summary.runs,
          items_success: summary.runs,
          items_failed: itemsFailed,
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
