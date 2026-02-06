import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const { data: prompts, error } = await supabase
    .from('monitoring_prompts')
    .select('id, prompt_text, is_active, source, topic_id, country, language, intent, tags')
    .eq('project_id', project.id)
    .eq('topic_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prompts: prompts || [] });
}
