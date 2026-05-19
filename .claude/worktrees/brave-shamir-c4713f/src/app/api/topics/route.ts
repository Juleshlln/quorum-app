import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const { data: topics, error } = await supabase
    .from('monitoring_topics')
    .select('id, name, description, is_active, created_at')
    .eq('project_id', project.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topics: topics || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const projectId = body?.projectId;
  const name = String(body?.name || '').trim();
  const description = body?.description ? String(body.description).trim() : null;

  if (!projectId || !name) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('monitoring_topics')
    .insert({ project_id: projectId, name, description, is_active: true })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
