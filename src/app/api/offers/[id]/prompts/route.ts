import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { addOfferPrompt } from '@/lib/offer-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createAdminClient();
    const prompt = await addOfferPrompt({
      supabase,
      projectId: context.project.id,
      offerId: id,
      prompt: body?.prompt,
      intentId: body?.intent_id || null,
    });
    return NextResponse.json({ ok: true, prompt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Ajout de question impossible.' },
      { status: 400 },
    );
  }
}
