import { createClient } from '@supabase/supabase-js';

function buildWindowFromEnd(windowDays, windowEnd) {
  const safeDays = [7, 30, 90].includes(windowDays) ? windowDays : 30;
  const end = new Date(`${windowEnd}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  return {
    windowStart: start.toISOString().slice(0, 10),
    windowEnd,
    windowDays: safeDays,
  };
}

function buildSourcesSummary(citations) {
  const total = citations.length;
  const uniqueDomains = new Set(citations.map((c) => c.domain?.domain).filter(Boolean)).size;
  const uniqueUrls = new Set(citations.map((c) => c.url?.url).filter(Boolean)).size;
  const observed = citations.filter((c) => (c.method || 'observed') === 'observed').length;
  const probable = citations.filter((c) => (c.method || 'observed') === 'probable').length;
  const owned = citations.filter((c) => c.domain?.category === 'owned' || c.domain?.is_owned).length;
  const competitor = citations.filter((c) => c.domain?.category === 'competitor').length;
  const thirdParty = citations.filter((c) => c.domain?.category === 'third_party' || !c.domain?.category).length;

  const byDate = new Map();
  for (const c of citations) {
    const date = c.cited_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  }
  const series = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalCitations]) => ({ date, total_citations: totalCitations }));

  return {
    total_citations: total,
    unique_domains: uniqueDomains,
    unique_urls: uniqueUrls,
    observed_citations: observed,
    probable_citations: probable,
    owned_citations: owned,
    competitor_citations: competitor,
    third_party_citations: thirdParty,
    owned_share: total > 0 ? Math.round((owned / total) * 100) : 0,
    competitor_share: total > 0 ? Math.round((competitor / total) * 100) : 0,
    third_party_share: total > 0 ? Math.round((thirdParty / total) * 100) : 0,
    series,
  };
}

function diffMetrics(a, b) {
  const keys = [
    'total_citations',
    'unique_domains',
    'unique_urls',
    'observed_citations',
    'probable_citations',
    'owned_share',
    'competitor_share',
    'third_party_share',
  ];
  const out = {};
  for (const key of keys) {
    const left = Number(a?.[key] ?? 0);
    const right = Number(b?.[key] ?? 0);
    out[key] = { computed: left, stored: right, delta: left - right };
  }
  return out;
}

function check(condition, code, detail, severity = 'warn') {
  return condition ? null : { code, severity, detail };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  const projectId = process.env.PROJECT_ID || process.argv[2];

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE URL or service role key.');
    process.exit(1);
  }
  if (!projectId) {
    console.error('Missing PROJECT_ID. Usage: PROJECT_ID=<uuid> node scripts/audit-monitoring.mjs');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id,name,user_id,website,created_at')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError) {
    console.error('Failed to load project:', projectError.message);
    process.exit(1);
  }
  if (!project) {
    console.error('Project not found:', projectId);
    process.exit(1);
  }

  const { data: runs, error: runsError } = await supabase
    .from('monitoring_runs')
    .select('id,status,run_date,window_start,window_end,started_at,finished_at,items_total,items_success,items_failed')
    .eq('project_id', projectId)
    .order('finished_at', { ascending: false })
    .limit(20);
  if (runsError) {
    console.error('Failed to load monitoring_runs:', runsError.message);
    process.exit(1);
  }
  const latestSuccessfulRun = (runs || []).find((r) => r.status === 'success' || r.status === 'partial') || null;

  const { data: metricsRows, error: metricsError } = await supabase
    .from('project_metrics_windowed')
    .select('id,window_days,window_start,window_end,run_id,metrics,updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (metricsError) {
    console.error('Failed to load project_metrics_windowed:', metricsError.message);
    process.exit(1);
  }
  const latest30 = (metricsRows || []).find((m) => Number(m.window_days) === 30) || null;

  const { data: allCitations, error: citationsError } = await supabase
    .from('citations')
    .select('id,cited_at,method,run_id,prompt_id,prompt_run_id,ai_model,domain_id,url_id,domain:sources_domains(domain,category,is_owned),url:sources_urls(url)')
    .eq('project_id', projectId);
  if (citationsError) {
    console.error('Failed to load citations:', citationsError.message);
    process.exit(1);
  }
  const citations = allCitations || [];

  const effectiveWindowEnd = latestSuccessfulRun?.window_end || new Date().toISOString().slice(0, 10);
  const window30 = buildWindowFromEnd(30, effectiveWindowEnd);
  const startTs = `${window30.windowStart}T00:00:00Z`;
  const endTs = `${window30.windowEnd}T23:59:59.999Z`;
  const windowedCitations = citations.filter((c) => c.cited_at >= startTs && c.cited_at <= endTs);
  const computedMetrics = buildSourcesSummary(windowedCitations);

  const keyCounts = new Map();
  for (const c of citations) {
    const key = [
      c.run_id || 'null',
      c.prompt_id || 'null',
      c.ai_model || 'null',
      c.url_id || 'null',
      c.method || 'observed',
    ].join('|');
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }
  const duplicateGroups = Array.from(keyCounts.entries()).filter(([, count]) => count > 1);

  const checks = [
    check(!!latestSuccessfulRun, 'NO_LATEST_SUCCESS_RUN', 'No success/partial row in monitoring_runs.'),
    check(windowedCitations.length > 0, 'NO_WINDOWED_CITATIONS', 'No citations found in effective 30d window.'),
    check(computedMetrics.total_citations > 0, 'ZERO_TOTAL_CITATIONS', 'Computed total_citations is 0.'),
    check(
      Math.abs(100 - (computedMetrics.owned_share + computedMetrics.competitor_share + computedMetrics.third_party_share)) <= 2,
      'SHARE_SUM_INVALID',
      'owned_share + competitor_share + third_party_share is outside tolerance.'
    ),
    check(duplicateGroups.length === 0, 'DUPLICATE_IDEMPOTENCE_KEYS', `Duplicate citation keys found: ${duplicateGroups.length}`),
    check(citations.filter((c) => (c.method || 'observed') === 'observed' && !c.url_id).length === 0, 'OBSERVED_WITHOUT_URL', 'Observed citations with null url_id found.'),
    check(citations.filter((c) => !c.run_id).length === 0, 'CITATIONS_WITHOUT_RUN_ID', 'Some citations are not linked to monitoring_runs.'),
    check(!!latest30, 'MISSING_WINDOWED_METRICS_30D', 'No stored 30d row in project_metrics_windowed.'),
  ].filter(Boolean);

  const report = {
    project: {
      id: project.id,
      name: project.name,
      website: project.website,
      user_id: project.user_id,
    },
    lineage: {
      summary_source: '/api/projects/:id/sources/summary',
      kpi_source: 'project_metrics_windowed.metrics (fallback computed from citations)',
      table_source: '/api/sources (direct aggregations from citations)',
      latest_run_source: 'monitoring_runs status in (success,partial) ordered by finished_at desc',
    },
    counts: {
      monitoring_runs: (runs || []).length,
      citations_total: citations.length,
      citations_window_30d_effective: windowedCitations.length,
      project_metrics_rows: (metricsRows || []).length,
      project_metrics_30d_present: !!latest30,
    },
    latestSuccessfulRun,
    effectiveWindow30: window30,
    computedMetrics30d: computedMetrics,
    storedMetrics30d: latest30?.metrics || null,
    metricsDiff30d: latest30?.metrics ? diffMetrics(computedMetrics, latest30.metrics) : null,
    categoryBreakdownAllTime: {
      owned: citations.filter((c) => c.domain?.category === 'owned' || c.domain?.is_owned).length,
      competitor: citations.filter((c) => c.domain?.category === 'competitor').length,
      third_party_or_null: citations.filter((c) => c.domain?.category === 'third_party' || !c.domain?.category).length,
    },
    anomalies: checks,
  };

  console.log(JSON.stringify(report, null, 2));
  if (checks.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
