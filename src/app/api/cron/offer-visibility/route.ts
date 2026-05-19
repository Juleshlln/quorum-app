import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runOfferVisibilityCron } from '@/lib/offer-visibility/service';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = request.headers.get('x-cron-secret') || '';
  const secret = bearerToken || headerSecret;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const supabase = createAdminClient();
    const payload = await runOfferVisibilityCron({
      supabase,
      maxOffers: body?.max_offers ? Number(body.max_offers) : undefined,
      maxPromptsPerOffer: body?.max_prompts_per_offer ? Number(body.max_prompts_per_offer) : undefined,
    });

    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cron Offer Visibility en échec.' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
