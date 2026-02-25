import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

function getNextRunAtUtc(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(7, 0, 0, 0);
  if (now >= next) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

function getTodayUtcDateString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

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

  const todayUtc = getTodayUtcDateString();

  const { data: todayRun } = await supabase
    .from('monitoring_daily_runs')
    .select('id, run_date, status, finished_at, monitoring_run_id')
    .eq('project_id', project.id)
    .eq('run_date', todayUtc)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastRun } = await supabase
    .from('monitoring_daily_runs')
    .select('id, run_date, status, finished_at, monitoring_run_id')
    .eq('project_id', project.id)
    .order('run_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const didRunToday = Boolean(
    todayRun &&
    todayRun.finished_at &&
    todayRun.monitoring_run_id &&
    (todayRun.status === 'success' || todayRun.status === 'partial')
  );

  return NextResponse.json({
    next_run_at_utc: getNextRunAtUtc(),
    did_run_today: didRunToday,
    last_daily_run_finished_at: lastRun?.finished_at || null,
    last_daily_run_status: lastRun?.status || null,
  });
}
