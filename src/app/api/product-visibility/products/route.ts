import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createProductVisibilityProduct, getProductVisibilityProducts } from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility, resolveProductVisibilityWindow } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const window = resolveProductVisibilityWindow(request.url, 30);
    const supabase = createAdminClient();

    const payload = await getProductVisibilityProducts({
      supabase,
      projectId: context.project.id,
      window,
    });

    return NextResponse.json({ ok: true, window, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de charger les produits.',
        products: [],
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
    const product = await createProductVisibilityProduct({
      supabase,
      projectId: context.project.id,
      input: {
        name: String(body?.name || ''),
        brand: body?.brand ? String(body.brand) : null,
        url: body?.url ? String(body.url) : null,
        categoryId: body?.categoryId ? String(body.categoryId) : null,
        categoryName: body?.categoryName ? String(body.categoryName) : null,
        description: body?.description ? String(body.description) : null,
        useCase: body?.useCase ? String(body.useCase) : null,
        targetCustomer: body?.targetCustomer ? String(body.targetCustomer) : null,
        attributes: body?.attributes ? String(body.attributes) : null,
        isOwnedProduct: body?.isOwnedProduct !== false,
        competitorBrand: body?.competitorBrand ? String(body.competitorBrand) : null,
        imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Produit ajouté avec succès.',
      product,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible d’ajouter le produit.',
      },
      { status: 400 },
    );
  }
}
