import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';
import { runOverviewAnalysis } from '@/lib/overview/product-visibility-overview';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createAdminClient();
    const payload = await runOverviewAnalysis({
      supabase,
      projectId: context.project.id,
      maxOffers: Number.isFinite(Number(body?.max_offers)) ? Number(body.max_offers) : 5,
      maxPrompts: Number.isFinite(Number(body?.max_prompts)) ? Number(body.max_prompts) : 3,
    });

    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Analyse impossible.' },
      { status: 400 },
    );
  }
}
