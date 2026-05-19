import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

function normalizePromptIntent(value: unknown) {
  const intent = typeof value === 'string' ? value : null;
  if (!intent) return null;
  if (intent === 'information' || intent === 'recommendation') return 'discovery';
  if (intent === 'decision' || intent === 'achat') return 'purchase';
  if (intent === 'attribute-based' || intent === 'attribute_based') return 'specification';
  if (['discovery', 'comparison', 'purchase', 'use_case', 'specification', 'brand', 'category', 'competitive'].includes(intent)) {
    return intent;
  }
  return 'discovery';
}

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
  const categoryId = body?.category_id ?? null;
  const buyingIntent = body?.buying_intent ? String(body.buying_intent) : null;
  const topicLabel = body?.topic_label ? String(body.topic_label) : null;
  const monitoringFrequency = body?.monitoring_frequency ? String(body.monitoring_frequency) : null;
  const targetProductIds = Array.isArray(body?.target_product_ids)
    ? body.target_product_ids.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  const text = String(body?.prompt_text || '').trim();
  const source = body?.source === 'template' ? 'template' : 'custom';
  const country = body?.country ? String(body.country) : null;
  const language = body?.language ? String(body.language) : null;
  const intent = normalizePromptIntent(body?.intent);
  const tags = Array.isArray(body?.tags) ? body.tags.map((t: unknown) => String(t)) : [];

  if (!text) {
    return NextResponse.json({ error: 'Prompt text required' }, { status: 400 });
  }

  const baseInsertPayload: Record<string, unknown> = {
    project_id: project.id,
    prompt_text: text,
    source,
    topic_id: topicId,
    country,
    language,
    intent,
    tags,
    is_active: true,
    status: 'active',
    prompt_origin: 'radar',
    scope: categoryId ? 'category' : 'brand',
    quality_status: 'needs_review',
    lifecycle_status: 'active',
    locale: language === 'English' || language === 'Anglais' ? 'en-US' : 'fr-FR',
  };
  const legacyInsertPayload: Record<string, unknown> = {
    project_id: project.id,
    prompt_text: text,
    source,
    topic_id: topicId,
    country,
    language,
    intent,
    tags,
    is_active: true,
    status: 'active',
  };

  const extendedInsertPayload: Record<string, unknown> = { ...baseInsertPayload };
  if (categoryId !== null) extendedInsertPayload.category_id = categoryId;
  if (buyingIntent !== null) extendedInsertPayload.buying_intent = buyingIntent;
  if (topicLabel !== null) extendedInsertPayload.topic_label = topicLabel;
  if (monitoringFrequency !== null) extendedInsertPayload.monitoring_frequency = monitoringFrequency;

  let { data, error } = await supabase
    .from('monitoring_prompts')
    .insert(extendedInsertPayload)
    .select('id')
    .single();

  if (error && /column .* does not exist/i.test(error.message || '')) {
    const fallbackResult = await supabase
      .from('monitoring_prompts')
      .insert(legacyInsertPayload)
      .select('id')
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 });
  }

  const { error: versionError } = await supabase
    .from('prompt_versions')
    .insert({
      prompt_id: data.id,
      version_number: 1,
      prompt_text: text,
      is_active: true,
    });

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  if (targetProductIds.length > 0) {
    const rows = targetProductIds.map((productId: string) => ({
      project_id: project.id,
      prompt_id: data.id,
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

  return NextResponse.json({ id: data.id });
}
