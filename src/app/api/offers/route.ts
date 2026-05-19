import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createOffer, getOffers } from '@/lib/offer-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function GET() {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const supabase = createAdminClient();
    const payload = await getOffers({ supabase, projectId: context.project.id });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Impossible de charger les offres.', offers: [] },
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
    const payload = await createOffer({
      supabase,
      projectId: context.project.id,
      userId: context.user.id,
      input: body,
    });

    return NextResponse.json({ ok: true, ...payload }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Création de l’offre impossible.' },
      { status: 400 },
    );
  }
}
