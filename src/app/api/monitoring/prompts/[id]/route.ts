import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  if (body?.category_id !== undefined) updates.category_id = body.category_id;
  if (typeof body?.buying_intent === 'string') updates.buying_intent = body.buying_intent;
  if (typeof body?.topic_label === 'string') updates.topic_label = body.topic_label;
  if (typeof body?.monitoring_frequency === 'string') updates.monitoring_frequency = body.monitoring_frequency;

  const nextText = typeof body?.prompt_text === 'string' ? body.prompt_text.trim() : null;

  if (nextText && nextText.length > 0) {
    const { data: promptRow, error: promptError } = await supabase
      .from('monitoring_prompts')
      .select('prompt_text')
      .eq('id', id)
      .single();

    if (promptError) {
      return NextResponse.json({ error: promptError.message }, { status: 500 });
    }

    if (promptRow?.prompt_text !== nextText) {
      const { data: versions } = await supabase
        .from('prompt_versions')
        .select('id, version_number')
        .eq('prompt_id', id)
        .order('version_number', { ascending: false })
        .limit(1);

      const latestVersion = versions?.[0];
      const nextVersion = (latestVersion?.version_number || 0) + 1;

      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', id)
        .eq('is_active', true);

      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: id,
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

  const fallbackUpdates: Record<string, unknown> = { ...updates };
  delete fallbackUpdates.category_id;
  delete fallbackUpdates.buying_intent;
  delete fallbackUpdates.topic_label;
  delete fallbackUpdates.monitoring_frequency;

  let { error } = await supabase
    .from('monitoring_prompts')
    .update(updates)
    .eq('id', id);

  if (error && /column .* does not exist/i.test(error.message || '')) {
    if (Object.keys(fallbackUpdates).length > 0) {
      const fallbackResult = await supabase
        .from('monitoring_prompts')
        .update(fallbackUpdates)
        .eq('id', id);
      error = fallbackResult.error;
    } else {
      error = null;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body?.target_product_ids)) {
    const targetProductIds = body.target_product_ids.map((value: unknown) => String(value)).filter(Boolean);

    const { data: promptRow } = await supabase
      .from('monitoring_prompts')
      .select('project_id')
      .eq('id', id)
      .single();

    const projectId = promptRow?.project_id;

    if (projectId) {
      await supabase
        .from('monitoring_prompt_products')
        .delete()
        .eq('prompt_id', id)
        .eq('project_id', projectId);

      if (targetProductIds.length > 0) {
        const rows = targetProductIds.map((productId: string) => ({
          project_id: projectId,
          prompt_id: id,
          product_id: productId,
          is_primary: false,
        }));

        const { error: relationError } = await supabase
          .from('monitoring_prompt_products')
          .upsert(rows, { onConflict: 'prompt_id,product_id' });

        if (relationError && !/relation .*monitoring_prompt_products.* does not exist/i.test(relationError.message || '')) {
          return NextResponse.json({ error: relationError.message }, { status: 500 });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('monitoring_prompts')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
