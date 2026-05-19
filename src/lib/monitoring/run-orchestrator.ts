import { runMonitoringForProject } from '@/lib/monitoring/run-monitoring';
import { buildSourcesSummary } from '@/lib/monitoring/metrics';
import { buildRunWindow, buildWindowFromEnd, hashModels } from '@/lib/monitoring/run-window';
import { logRun } from '@/lib/monitoring/run-logs';
import { computeAndUpsertDailyMetrics } from '@/lib/monitoring/compute-daily-metrics';

const DEFAULT_MODELS = ['gpt-4o'];

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

export async function isValidCompletedRun(supabase: any, runId: string) {
  const { data: runRow } = await supabase
    .from('monitoring_runs')
    .select('id, items_total, items_processed')
    .eq('id', runId)
    .maybeSingle();

  const { data: successPromptRuns } = await supabase
    .from('prompt_runs')
    .select('id')
    .eq('run_id', runId)
    .eq('status', 'success');

  const successIds = (successPromptRuns || []).map((r: { id: string }) => r.id);

  const itemsTotal = Number(runRow?.items_total || 0);
  const itemsProcessed = Number(runRow?.items_processed || 0);
  const successfulPromptRuns = successIds.length;

  // Verify that actual AI answers exist (not just prompt_run rows marked success)
  let answersCount = 0;
  if (successIds.length > 0) {
    const { count } = await supabase
      .from('ai_answers')
      .select('id', { count: 'exact', head: true })
      .in('prompt_run_id', successIds);
    answersCount = Number(count || 0);
  }

  // A run is valid only if it processed items, has successful prompt_runs,
  // AND those prompt_runs have actual AI answers stored
  return {
    valid: itemsTotal > 0 && itemsProcessed > 0 && successfulPromptRuns > 0 && answersCount > 0,
    itemsTotal,
    itemsProcessed,
    linkedPromptRuns: successfulPromptRuns,
    answersCount,
  };
}

export async function createMonitoringRun({
  supabase,
  projectId,
  windowDays = 30,
  models = DEFAULT_MODELS,
  createdBy = null,
  force = false,
}: {
  supabase: any;
  projectId: string;
  windowDays?: number;
  models?: string[];
  createdBy?: string | null;
  force?: boolean;
}) {
  const window = buildRunWindow(windowDays);
  const baseModelsHash = hashModels(models);
  const modelsHash = force
    ? `${baseModelsHash}:manual:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
    : baseModelsHash;

  // Manual runs intentionally bypass deduplication. They need their own
  // models_hash because the DB uniquely indexes project/window/models_hash.
  if (!force) {
    const { data: existing } = await supabase
      .from('monitoring_runs')
      .select('*')
      .eq('project_id', projectId)
      .eq('window_start', window.windowStart)
      .eq('window_end', window.windowEnd)
      .eq('models_hash', modelsHash)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'success' || existing.status === 'partial') {
        const validation = await isValidCompletedRun(supabase, existing.id);
        if (!validation.valid) {
          const { data: resetRun } = await supabase
            .from('monitoring_runs')
            .update({
              status: 'queued',
              started_at: null,
              finished_at: null,
              items_total: 0,
              items_processed: 0,
              items_success: 0,
              items_failed: 0,
              duration_ms: null,
              error_message: `Recovered invalid completed run (items_total=${validation.itemsTotal}, prompt_runs=${validation.linkedPromptRuns})`,
              error_stack: null,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          return { run: resetRun || existing, reused: false };
        }
      }
      return { run: existing, reused: true };
    }
  }

  const { data: inserted, error } = await supabase
    .from('monitoring_runs')
    .insert({
      project_id: projectId,
      status: 'queued',
      window_start: window.windowStart,
      window_end: window.windowEnd,
      window_days: window.windowDays,
      models,
      models_hash: modelsHash,
      run_date: window.windowEnd,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Failed to create monitoring run');
  }

  return { run: inserted, reused: false };
}

export async function executeMonitoringRun({
  supabase,
  runId,
  promptIds,
}: {
  supabase: any;
  runId: string;
  // Restreint l'exécution à un sous-ensemble de prompts (ex: prompts produit).
  // Quand omis : tous les prompts actifs du projet sont exécutés.
  promptIds?: string[];
}) {
  const { data: run } = await supabase
    .from('monitoring_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();

  if (!run) {
    throw new Error('Run not found');
  }

  console.log('[executeMonitoringRun] run loaded', {
    id: run.id,
    status: run.status,
    items_total: run.items_total,
    project_id: run.project_id,
  });

  if (run.status === 'success' || run.status === 'partial') {
    const validation = await isValidCompletedRun(supabase, run.id);
    console.log('[executeMonitoringRun] validation for completed run', {
      valid: validation.valid,
      itemsTotal: validation.itemsTotal,
      linkedPromptRuns: validation.linkedPromptRuns,
    });
    if (validation.valid) {
      return { skipped: true, ok: true, status: run.status, summary: { runs: validation.linkedPromptRuns, answers: validation.linkedPromptRuns } };
    }

    await supabase
      .from('monitoring_runs')
      .update({
        status: 'queued',
        started_at: null,
        finished_at: null,
        items_total: 0,
        items_processed: 0,
        items_success: 0,
        items_failed: 0,
        duration_ms: null,
        error_message: `Recovered invalid completed run (items_total=${validation.itemsTotal}, prompt_runs=${validation.linkedPromptRuns})`,
        error_stack: null,
      })
      .eq('id', runId);

    await logRun({
      supabase,
      monitoringRunId: run.id,
      runId: null,
      projectId: run.project_id,
      level: 'warn',
      step: 'execute_run',
      message: 'Completed run was invalid; re-queued for execution',
      meta: {
        items_total: validation.itemsTotal,
        prompt_runs_linked: validation.linkedPromptRuns,
      },
    });
  }

  const startedAt = new Date().toISOString();
  await supabase
    .from('monitoring_runs')
    .update({
      status: 'running',
      started_at: startedAt,
      finished_at: null,
      error_message: null,
      error_stack: null,
    })
    .eq('id', runId);

  const runStart = Date.now();
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, description, location, industry, keywords')
      .eq('id', run.project_id)
      .single();
    if (!project) {
      throw new Error('Project not found');
    }

    const { data: competitorsRows } = await supabase
      .from('competitors')
      .select('name')
      .eq('project_id', run.project_id);
    const competitors = (competitorsRows || []).map((row: { name: string }) => row.name);

    const context = buildContext(project);
    const models = Array.isArray(run.models) && run.models.length > 0 ? run.models : DEFAULT_MODELS;

    // Fetch active topic IDs to match the same filtering as runMonitoringForProject
    const { data: topicsData } = await supabase
      .from('monitoring_topics')
      .select('id, is_active')
      .eq('project_id', run.project_id);
    const activeTopicIds = new Set(
      (topicsData || []).filter((t: any) => t.is_active !== false).map((t: any) => t.id)
    );

    const { data: allPrompts } = await supabase
      .from('monitoring_prompts')
      .select('id, topic_id, is_active')
      .eq('project_id', run.project_id);
    const allowedPromptIds = promptIds && promptIds.length > 0 ? new Set(promptIds) : null;
    const activePrompts = (allPrompts || []).filter((p: any) => {
      if (p.is_active === false) return false;
      if (p.topic_id && !activeTopicIds.has(p.topic_id)) return false;
      if (allowedPromptIds && !allowedPromptIds.has(p.id)) return false;
      return true;
    });
    const itemsTotal = activePrompts.length * models.length;

    const summary = await runMonitoringForProject({
      supabase,
      runId: run.id,
      logRunId: null,
      projectId: run.project_id,
      brandName: project.name,
      competitors,
      context,
      runType: 'monitoring',
      scheduledAt: startedAt,
      runWindowStart: run.window_start,
      runWindowEnd: run.window_end,
      models,
      promptIds,
    });

    // items_success = actual AI answers, not just processed prompt_runs
    const itemsFailed = Math.max(0, itemsTotal - summary.answers);
    const status = itemsTotal === 0
      ? 'empty'
      : summary.answers === 0
        ? 'failed'
        : summary.answers < itemsTotal
          ? 'partial'
          : 'success';

    await supabase
      .from('monitoring_runs')
      .update({
        status,
        items_total: itemsTotal,
        items_processed: summary.runs,
        items_success: summary.answers,
        items_failed: itemsFailed,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
      })
      .eq('id', runId);

    await logRun({
      supabase,
      monitoringRunId: run.id,
      runId: null,
      projectId: run.project_id,
      step: 'execute_run',
      message: 'Monitoring run executed',
      meta: { itemsTotal, itemsFailed },
    });

    await refreshWindowMetrics({
      supabase,
      projectId: run.project_id,
      runId: run.id,
      windowEnd: run.window_end,
    });

    // Compute and upsert daily metrics for the Overview dashboard
    const runDay = startedAt.slice(0, 10); // YYYY-MM-DD
    await computeAndUpsertDailyMetrics({ supabase, projectId: run.project_id, day: runDay });

    return { ok: true, status, summary };
  } catch (err: any) {
    const message = err?.message || String(err);
    await logRun({
      supabase,
      monitoringRunId: run.id,
      runId: null,
      projectId: run.project_id,
      level: 'error',
      step: 'execute_run',
      message,
    });
    await supabase
      .from('monitoring_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
        error_message: message,
        error_stack: err?.stack || null,
      })
      .eq('id', runId);
    throw err;
  }
}

export async function refreshWindowMetrics({
  supabase,
  projectId,
  runId,
  windowEnd,
}: {
  supabase: any;
  projectId: string;
  runId: string | null;
  windowEnd: string;
}) {
  const windows = [7, 30, 90];
  for (const windowDays of windows) {
    const window = buildWindowFromEnd(windowDays, windowEnd);
    const startTs = `${window.windowStart}T00:00:00Z`;
    const endTs = `${window.windowEnd}T23:59:59.999Z`;

    const { data: citations } = await supabase
      .from('citations')
      .select('cited_at, method, domain:sources_domains(domain, category, is_owned), url:sources_urls(url)')
      .eq('project_id', projectId)
      .eq('is_fallback', false)
      .gte('cited_at', startTs)
      .lte('cited_at', endTs);

    const metrics = buildSourcesSummary((citations || []) as any[]);
    await supabase
      .from('project_metrics_windowed')
      .upsert({
        project_id: projectId,
        run_id: runId,
        window_days: window.windowDays,
        window_start: window.windowStart,
        window_end: window.windowEnd,
        metrics,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,window_days,window_start,window_end',
      });
  }
}
