import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  const sourceId = await resolveId(context);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 10)));

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('product_catalog_imports')
    .select('id, source_id, started_at, finished_at, status, inserted_count, updated_count, skipped_count, error_count, errors, summary')
    .eq('project_id', ctx.project.id)
    .eq('source_id', sourceId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, imports: [] }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imports: data || [] });
}
