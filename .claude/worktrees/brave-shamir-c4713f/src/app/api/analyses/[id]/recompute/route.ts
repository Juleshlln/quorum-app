import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeModules, type ModuleKey, type RawItem } from '@/lib/analysis/modules';

const ALL_MODULES: ModuleKey[] = ['visibility', 'position', 'sentiment', 'global'];

function normalizeModule(input: unknown): ModuleKey[] {
  if (!input) return ALL_MODULES;
  const value = String(input).toLowerCase();
  if (value === 'all' || value === 'complete') return ALL_MODULES;
  if (ALL_MODULES.includes(value as ModuleKey)) return [value as ModuleKey];
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const modules = normalizeModule(body?.module);
    if (modules.length === 0) {
      return NextResponse.json({ error: 'Invalid module' }, { status: 400 });
    }

    const { data: analysisData, error: analysisError } = await supabase
      .from('analyses')
      .select('id, project_id')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysisData) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const { data: itemsData } = await supabase
      .from('analysis_items')
      .select('prompt_text, ai_response, brand_mentioned, brand_position, competitors_mentioned, website_cited, sentiment_label')
      .eq('analysis_id', analysisId);

    const items = (itemsData as RawItem[] | null) || [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'No data to recompute' }, { status: 400 });
    }

    const moduleResults = computeModules(items, modules);
    const rows = moduleResults.map((m) => ({
      analysis_id: analysisId,
      module_key: m.module_key,
      score: m.score,
      details: m.details,
    }));

    const { error: upsertError } = await supabase
      .from('analysis_module_results')
      .upsert(rows, { onConflict: 'analysis_id,module_key' });

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to recompute module' }, { status: 500 });
    }

    return NextResponse.json({ success: true, modules: moduleResults.map((m) => m.module_key) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
