import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: dailyRuns } = await supabase
    .from('monitoring_daily_runs')
    .select('*')
    .eq('project_id', project.id)
    .order('run_date', { ascending: false })
    .limit(30);

  const { count: promptRunsCount } = await supabase
    .from('prompt_runs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('run_type', 'monitoring')
    .gte('scheduled_at', since30);

  const { count: responsesCount } = await supabase
    .from('monitoring_responses')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .gte('created_at', since30);

  const { count: observedCount } = await supabase
    .from('citations')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('method', 'observed')
    .gte('cited_at', since30);

  const { count: probableCount } = await supabase
    .from('citations')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('method', 'probable')
    .gte('cited_at', since30);

  const { count: errorsCount } = await supabase
    .from('run_logs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('level', 'error')
    .gte('created_at', since30);

  return NextResponse.json({
    project_id: project.id,
    daily_runs: dailyRuns || [],
    stats_30d: {
      prompt_runs: promptRunsCount || 0,
      responses: responsesCount || 0,
      citations_observed: observedCount || 0,
      citations_probable: probableCount || 0,
      errors: errorsCount || 0,
    },
  });
}
