import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getProductVisibilityCategoryDetail } from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility, resolveProductVisibilityWindow } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Identifiant catégorie obligatoire.' }, { status: 400 });
  }

  try {
    const window = resolveProductVisibilityWindow(request.url, 30);
    const supabase = createAdminClient();

    const payload = await getProductVisibilityCategoryDetail({
      supabase,
      projectId: context.project.id,
      categoryId: id,
      window,
    });

    return NextResponse.json({ ok: true, window, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de charger le détail de la catégorie.',
        category: null,
        summary: null,
        prompts: [],
        owned_products: [],
        competitor_products: [],
        product_ranking: [],
        top_attributes: [],
        cited_sources: [],
        recommendations: [],
        matrix: {
          high_visibility_positive: 0,
          high_visibility_negative: 0,
          low_visibility_positive: 0,
          low_visibility_negative: 0,
        },
      },
      { status: 500 },
    );
  }
}
