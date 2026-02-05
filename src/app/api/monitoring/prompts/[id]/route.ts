import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (typeof body?.is_active === 'boolean') updates.is_active = body.is_active;
  if (body?.topic_id !== undefined) updates.topic_id = body.topic_id;
  if (typeof body?.status === 'string') updates.status = body.status;

  const nextText = typeof body?.prompt_text === 'string' ? body.prompt_text.trim() : null;

  if (nextText && nextText.length > 0) {
    const { data: promptRow, error: promptError } = await supabase
      .from('monitoring_prompts')
      .select('prompt_text')
      .eq('id', params.id)
      .single();

    if (promptError) {
      return NextResponse.json({ error: promptError.message }, { status: 500 });
    }

    if (promptRow?.prompt_text !== nextText) {
      const { data: versions } = await supabase
        .from('prompt_versions')
        .select('id, version_number')
        .eq('prompt_id', params.id)
        .order('version_number', { ascending: false })
        .limit(1);

      const latestVersion = versions?.[0];
      const nextVersion = (latestVersion?.version_number || 0) + 1;

      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', params.id)
        .eq('is_active', true);

      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: params.id,
          version_number: nextVersion,
          prompt_text: nextText,
          is_active: true,
        });

      if (versionError) {
        return NextResponse.json({ error: versionError.message }, { status: 500 });
      }

      updates.prompt_text = nextText;
    }
  }

  const { error } = await supabase
    .from('monitoring_prompts')
    .update(updates)
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('monitoring_prompts')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
