import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runOfferAnalysis } from '@/lib/offer-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const maxPrompts = body?.max_prompts ? Number(body.max_prompts) : undefined;
    const supabase = createAdminClient();
    const payload = await runOfferAnalysis({
      supabase,
      projectId: context.project.id,
      offerId: id,
      maxPrompts: Number.isFinite(maxPrompts) ? maxPrompts : undefined,
    });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Analyse impossible.' },
      { status: 400 },
    );
  }
}
