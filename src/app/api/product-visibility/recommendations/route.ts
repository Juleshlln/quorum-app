import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getProductVisibilityRecommendations } from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility, resolveProductVisibilityWindow } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const window = resolveProductVisibilityWindow(request.url, 30);
    const supabase = createAdminClient();

    const payload = await getProductVisibilityRecommendations({
      supabase,
      projectId: context.project.id,
      window,
    });

    return NextResponse.json({ ok: true, window, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de charger les recommandations.',
        recommendations: [],
      },
      { status: 500 },
    );
  }
}
