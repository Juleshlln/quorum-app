import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { createMonitoringRun } from '@/lib/monitoring/run-orchestrator';
import { normalizeWindowParam } from '@/lib/monitoring/run-window';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const windowParam = normalizeWindowParam(body?.window);
  const models = Array.isArray(body?.models) ? body.models : undefined;

  let projectId = body?.projectId as string | undefined;
  if (projectId) {
    const { data: project, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
  } else {
    const project = await getActiveProjectForUser(user.id);
    if (!project) {
      return NextResponse.json({ error: 'No active project' }, { status: 400 });
    }
    projectId = project.id;
  }

  try {
    const { run, reused } = await createMonitoringRun({
      supabase,
      projectId,
      windowDays: windowParam,
      models,
      createdBy: user.id,
    });
    return NextResponse.json({
      ok: true,
      run,
      reused,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create run' }, { status: 500 });
  }
}
