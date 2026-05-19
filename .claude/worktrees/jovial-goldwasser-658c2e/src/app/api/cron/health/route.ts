import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

interface DailyRunRow {
  run_date: string;
  status: string | null;
  error_message: string | null;
  monitoring_run_id: string | null;
  items_success: number | null;
  items_failed: number | null;
  items_total: number | null;
  duration_ms: number | null;
  finished_at: string | null;
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

  // Fetch last 7 days of daily runs
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: runs } = await supabase
    .from('monitoring_daily_runs')
    .select('run_date, status, error_message, monitoring_run_id, items_success, items_failed, items_total, duration_ms, finished_at')
    .eq('project_id', project.id)
    .gte('run_date', startDate)
    .order('run_date', { ascending: false });

  // Build a map keyed by date (keep only the latest run per date)
  const byDate = new Map<string, DailyRunRow>();
  for (const run of (runs || []) as DailyRunRow[]) {
    if (!byDate.has(run.run_date)) {
      byDate.set(run.run_date, run);
    }
  }

  // Build last 7 days array (include days with no run)
  const last7Days: Array<{
    date: string;
    status: string;
    error?: string;
    citations?: number;
    duration_ms?: number;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const run = byDate.get(dateStr);

    if (!run) {
      last7Days.push({ date: dateStr, status: 'no_run' });
    } else {
      const entry: (typeof last7Days)[number] = {
        date: dateStr,
        status: run.status || 'unknown',
      };
      if (run.error_message) entry.error = run.error_message;
      if (run.items_success != null) entry.citations = run.items_success;
      if (run.duration_ms != null) entry.duration_ms = run.duration_ms;
      last7Days.push(entry);
    }
  }

  const totalWithRuns = last7Days.filter(d => d.status !== 'no_run').length;
  const successCount = last7Days.filter(d => d.status === 'success' || d.status === 'partial').length;
  const successRate = totalWithRuns > 0
    ? `${Math.round((successCount / totalWithRuns) * 100)}%`
    : 'N/A';

  return NextResponse.json({
    last_7_days: last7Days,
    success_rate: successRate,
    total_runs: totalWithRuns,
    successful_runs: successCount,
  });
}
