import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const projectId = body?.projectId;
  const prompt_text = String(body?.prompt_text || '').trim();
  const source = body?.source === 'template' ? 'template' : 'custom';
  const template_id = body?.template_id || null;
  const topic_id = body?.topic_id || null;

  if (!projectId || !prompt_text) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('monitoring_prompts')
    .insert({
      project_id: projectId,
      prompt_text,
      source,
      template_id,
      topic_id,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
