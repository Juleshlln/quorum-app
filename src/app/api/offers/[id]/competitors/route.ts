import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getOfferCompetitors } from '@/lib/offer-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const payload = await getOfferCompetitors({ supabase, projectId: context.project.id, offerId: id });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Concurrents indisponibles.', competitors: [] },
      { status: 400 },
    );
  }
}
