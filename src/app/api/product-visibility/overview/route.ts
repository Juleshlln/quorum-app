import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  emptyProductVisibilityOverviewStandard,
  getProductVisibilityOverviewStandard,
} from '@/lib/product-visibility/service';
import {
  requireActiveProjectForProductVisibility,
  resolveProductVisibilityRange,
} from '@/lib/product-visibility/request';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  const { range, window, previousWindow } = resolveProductVisibilityRange(request.url, '30d');

  try {
    const supabase = createAdminClient();
    const overview = await getProductVisibilityOverviewStandard({
      supabase,
      projectId: context.project.id,
      range,
      window,
      previousWindow,
    });

    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    console.error('[product-visibility/overview] failed', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger la vue d’ensemble Visibilité produit.',
        ...emptyProductVisibilityOverviewStandard({ range, window, previousWindow }),
      },
      { status: 500 },
    );
  }
}
