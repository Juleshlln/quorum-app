import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';
import { emptyOverview, getOverview, resolveOverviewRange } from '@/lib/overview/product-visibility-overview';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  const { range, selectedProvider, window, previousWindow } = resolveOverviewRange(request.url);

  try {
    const supabase = createAdminClient();
    const overview = await getOverview({
      supabase,
      projectId: context.project.id,
      projectName: context.project.name,
      range,
      selectedProvider,
      window,
      previousWindow,
    });

    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    console.error('[overview] failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Impossible de charger la vue d’ensemble.',
        ...emptyOverview({ range, selectedProvider, window, previousWindow }),
      },
      { status: 500 },
    );
  }
}
