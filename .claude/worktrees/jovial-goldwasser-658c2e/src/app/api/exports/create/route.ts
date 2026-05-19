import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateAndStoreDailyExport } from '@/lib/exports/daily-export';

export const runtime = 'nodejs';
export const maxDuration = 300;

type ExportType = 'daily_audit_pdf' | 'csv_export';

function isValidType(value: unknown): value is ExportType {
  return value === 'daily_audit_pdf' || value === 'csv_export';
}

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  const runDate = typeof body?.runDate === 'string' ? body.runDate : '';
  const type = body?.type;
  let runId = typeof body?.runId === 'string' ? body.runId : '';

  if (!projectId || !runDate || !isValidType(type)) {
    return NextResponse.json({ error: 'Missing or invalid body fields' }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabaseUser
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const supabaseAdmin = createAdminClient();

  if (!runId) {
    const { data: run } = await supabaseAdmin
      .from('monitoring_runs')
      .select('id')
      .eq('project_id', projectId)
      .eq('run_date', runDate)
      .in('status', ['success', 'partial'])
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!run?.id) {
      return NextResponse.json({ error: 'No monitoring run found for this date' }, { status: 404 });
    }

    runId = run.id;
  }

  const { data: runCheck } = await supabaseAdmin
    .from('monitoring_runs')
    .select('id, run_date, project_id')
    .eq('id', runId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!runCheck) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const { data: exportRow, error: insertError } = await supabaseAdmin
    .from('report_exports')
    .insert({
      project_id: projectId,
      run_id: runId,
      run_date: runCheck.run_date,
      type,
      status: 'queued',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertError || !exportRow) {
    return NextResponse.json({ error: insertError?.message || 'Failed to queue export' }, { status: 500 });
  }

  try {
    await generateAndStoreDailyExport({
      exportId: exportRow.id,
      projectId,
      runId,
      runDate: runCheck.run_date,
      type,
    });

    return NextResponse.json({ exportId: exportRow.id, status: 'done' });
  } catch (error: any) {
    return NextResponse.json({ exportId: exportRow.id, status: 'failed', error: error?.message || 'Export failed' }, { status: 500 });
  }
}
