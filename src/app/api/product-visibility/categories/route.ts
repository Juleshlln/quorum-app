import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createProductVisibilityCategory, getProductVisibilityCategories } from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility, resolveProductVisibilityWindow } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const window = resolveProductVisibilityWindow(request.url, 30);
    const supabase = createAdminClient();

    const payload = await getProductVisibilityCategories({
      supabase,
      projectId: context.project.id,
      window,
    });

    return NextResponse.json({ ok: true, window, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de charger les catégories.',
        categories: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createAdminClient();
    const category = await createProductVisibilityCategory({
      supabase,
      projectId: context.project.id,
      name: String(body?.name || ''),
      description: body?.description ? String(body.description) : null,
      priority: body?.priority ? String(body.priority) : 'medium',
      status: body?.status ? String(body.status) : 'active',
    });

    return NextResponse.json({
      ok: true,
      message: 'Catégorie créée avec succès.',
      category,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de créer la catégorie.',
      },
      { status: 400 },
    );
  }
}
