import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { executeMonitoringRun } from '@/lib/monitoring/run-orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STALE_RUN_MINUTES = 30;

function isStaleRun(startedAt: string | null | undefined) {
  if (!startedAt) return true;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return true;
  return Date.now() - started > STALE_RUN_MINUTES * 60 * 1000;
}

async function handleExecute(request: NextRequest) {
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

  const { data: running } = await supabase
    .from('monitoring_runs')
    .select('id, started_at')
    .eq('status', 'running');

  for (const run of running || []) {
    if (isStaleRun(run.started_at)) {
      await supabase
        .from('monitoring_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: `Run bloqué (> ${STALE_RUN_MINUTES} min)`,
        })
        .eq('id', run.id);
    }
  }

  const { data: queuedRuns } = await supabase
    .from('monitoring_runs')
    .select('id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(5);

  const results: Array<{ run_id: string; status: string }> = [];
  for (const row of queuedRuns || []) {
    try {
      await executeMonitoringRun({ supabase, runId: row.id });
      results.push({ run_id: row.id, status: 'success' });
    } catch (err: any) {
      results.push({ run_id: row.id, status: 'failed' });
    }
  }

  return NextResponse.json({ ok: true, processed: results });
}

export async function POST(request: NextRequest) {
  return handleExecute(request);
}

export async function GET(request: NextRequest) {
  return handleExecute(request);
}
