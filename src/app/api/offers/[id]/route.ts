import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { deactivateOffer, getOfferDetail, updateOffer } from '@/lib/offer-visibility/service';
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
    const detail = await getOfferDetail({ supabase, projectId: context.project.id, offerId: id });
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Offre introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Impossible de charger l’offre.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createAdminClient();
    const offer = await updateOffer({
      supabase,
      projectId: context.project.id,
      offerId: id,
      input: body,
    });
    return NextResponse.json({ ok: true, offer });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Mise à jour impossible.' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const offer = await deactivateOffer({
      supabase,
      projectId: context.project.id,
      offerId: id,
    });
    return NextResponse.json({ ok: true, offer });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Désactivation impossible.' },
      { status: 400 },
    );
  }
}
