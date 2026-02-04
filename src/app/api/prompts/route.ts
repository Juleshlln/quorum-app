import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const body = await request.json();
  const topicId = body?.topic_id ?? null;
  const text = String(body?.prompt_text || '').trim();
  const source = body?.source === 'template' ? 'template' : 'custom';
  const country = body?.country ? String(body.country) : null;
  const language = body?.language ? String(body.language) : null;
  const intent = body?.intent ? String(body.intent) : null;
  const tags = Array.isArray(body?.tags) ? body.tags.map((t: unknown) => String(t)) : [];

  if (!text) {
    return NextResponse.json({ error: 'Prompt text required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('monitoring_prompts')
    .insert({
      project_id: project.id,
      prompt_text: text,
      source,
      topic_id: topicId,
      country,
      language,
      intent,
      tags,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
