import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateProductVisibilityRecommendations } from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility, resolveProductVisibilityWindow } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const body = await request.json().catch(() => ({}));
    const persist = body?.persist !== false;

    const window = resolveProductVisibilityWindow(request.url, 30);
    const supabase = createAdminClient();

    const payload = await generateProductVisibilityRecommendations({
      supabase,
      projectId: context.project.id,
      window,
      persist,
    });

    return NextResponse.json({
      ok: true,
      persisted: persist,
      window,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de générer les recommandations.',
        recommendations: [],
      },
      { status: 500 },
    );
  }
}
