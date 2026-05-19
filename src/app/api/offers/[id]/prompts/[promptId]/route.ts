import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { setOfferPromptActive } from '@/lib/offer-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promptId: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;
  const { id, promptId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createAdminClient();
    const prompt = await setOfferPromptActive({
      supabase,
      projectId: context.project.id,
      offerId: id,
      promptId,
      isActive: body?.is_active !== false,
    });
    return NextResponse.json({ ok: true, prompt });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Mise à jour de la question impossible.' },
      { status: 400 },
    );
  }
}
