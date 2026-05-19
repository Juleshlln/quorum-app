import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getProductVisibilityProductDetail } from '@/lib/product-visibility/service';
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
    return NextResponse.json({ error: 'Identifiant produit obligatoire.' }, { status: 400 });
  }

  try {
    const window = resolveProductVisibilityWindow(request.url, 30);
    const supabase = createAdminClient();

    const payload = await getProductVisibilityProductDetail({
      supabase,
      projectId: context.project.id,
      productId: id,
      window,
    });

    return NextResponse.json({ ok: true, window, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de charger le détail du produit.',
        product: null,
        metrics: null,
        prompts: [],
        related_competitors: [],
        sources: [],
        attributes: [],
        ranking: null,
        recommendations: [],
      },
      { status: 500 },
    );
  }
}
