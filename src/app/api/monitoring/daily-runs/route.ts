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

  const { data: runs } = await supabase
    .from('monitoring_daily_runs')
    .select('*')
    .eq('project_id', project.id)
    .order('run_date', { ascending: false })
    .limit(30);

  const { data: logs } = await supabase
    .from('run_logs')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json({ runs: runs || [], logs: logs || [] });
}
