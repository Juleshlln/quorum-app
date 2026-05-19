import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';
import { toPublicSource } from '@/lib/product-catalog/sync';
import type { CatalogSourceRow } from '@/lib/product-catalog/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function GET(_: NextRequest, context: RouteContext) {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  const id = await resolveId(context);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('product_catalog_sources')
    .select('*')
    .eq('project_id', ctx.project.id)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Source introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, source: toPublicSource(data as CatalogSourceRow) });
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  const id = await resolveId(context);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('product_catalog_sources')
    .delete()
    .eq('project_id', ctx.project.id)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
