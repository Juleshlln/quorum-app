import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateProductVisibilityPrompts } from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const body = await request.json().catch(() => ({}));
    const persist = body?.persist === true;
    const productId = body?.productId || body?.product_id ? String(body.productId || body.product_id) : null;
    const activateValid = body?.activateValid === true || body?.activate_valid === true || !productId;
    const locale = body?.locale === 'en-US' ? 'en-US' : 'fr-FR';
    const engines = Array.isArray(body?.engines)
      ? body.engines
          .map((engine: unknown) => {
            if (!engine || typeof engine !== 'object') return null;
            const row = engine as Record<string, unknown>;
            const id = row.engine ? String(row.engine) : '';
            if (!id) return null;
            return {
              engine: id,
              model: row.model ? String(row.model) : null,
            };
          })
          .filter(Boolean)
      : [];

    const supabase = createAdminClient();
    const payload = await generateProductVisibilityPrompts({
      supabase,
      projectId: context.project.id,
      productId,
      persist,
      activateValid,
      locale,
      engines,
    });

    return NextResponse.json({
      ok: true,
      persisted: persist,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de générer les requêtes IA.',
        suggestions: [],
      },
      { status: 500 },
    );
  }
}
