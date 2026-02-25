import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeWindowParam, buildWindowFromEnd } from '@/lib/monitoring/run-window';
import { buildSourcesSummary } from '@/lib/monitoring/metrics';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const windowDays = normalizeWindowParam(searchParams.get('window'));

  const { data: latestRun } = await supabase
    .from('monitoring_runs')
    .select('id, window_end, finished_at, status')
    .eq('project_id', projectId)
    .in('status', ['success', 'partial'])
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) {
    return NextResponse.json({ ok: true, metrics: null, latestRun: null });
  }

  const window = buildWindowFromEnd(windowDays, latestRun.window_end);

  const { data: metricsRow } = await supabase
    .from('project_metrics_windowed')
    .select('metrics, window_start, window_end, window_days, run_id')
    .eq('project_id', projectId)
    .eq('window_days', window.windowDays)
    .eq('window_start', window.windowStart)
    .eq('window_end', window.windowEnd)
    .maybeSingle();

  if (metricsRow?.metrics) {
    return NextResponse.json({
      ok: true,
      window,
      latestRun,
      metrics: metricsRow.metrics,
    });
  }

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
      run_id: latestRun.id,
      window_days: window.windowDays,
      window_start: window.windowStart,
      window_end: window.windowEnd,
      metrics,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'project_id,window_days,window_start,window_end',
    });

  return NextResponse.json({
    ok: true,
    window,
    latestRun,
    metrics,
  });
}
