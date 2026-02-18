import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
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
  const runDate = getParisRunDate();
  const startedAt = new Date().toISOString();

  const { data: existingRaw } = await supabase
    .from('monitoring_daily_runs')
    .select('id, status, started_at')
    .eq('project_id', project.id)
    .eq('run_date', runDate)
    .maybeSingle();
  const existing = (existingRaw || null) as { id: string; status: string | null; started_at: string | null } | null;

  if (existing?.status === 'success') {
    return NextResponse.json({ ok: true, skipped: true, status: existing.status });
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
    const { data: projectRow } = await supabase
      .from('projects')
      .select('id, name, description, location, industry, keywords')
      .eq('id', project.id)
      .single();
    if (!projectRow) {
      throw new Error('Project not found');
    }

    const { data: competitorsRows } = await supabase
      .from('competitors')
      .select('name')
      .eq('project_id', project.id);
    const competitors = (competitorsRows || []).map((row: { name: string }) => row.name);
    const context = buildContext(projectRow);

    const { count: promptsCount } = await supabase
      .from('monitoring_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('is_active', true);

    const itemsTotal = (promptsCount || 0) * 1;

    const summary = await runMonitoringForProject({
      supabase,
      runId,
      projectId: project.id,
      brandName: projectRow.name,
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
