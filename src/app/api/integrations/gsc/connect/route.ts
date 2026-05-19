import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProject } from '@/lib/business-impact/request';
import { parseAnalyticsCredentials } from '@/lib/integrations/analytics/google-auth';
import { upsertAnalyticsConnection } from '@/lib/business-impact/sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

const schema = z.object({
  siteUrl: z.string().min(1),
  credentials: z.union([z.string().min(1), z.record(z.any())]),
});

export async function POST(request: NextRequest) {
  const context = await requireActiveProject();
  if (context.error) return context.error;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid GSC payload' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const connection = await upsertAnalyticsConnection({
      supabase,
      projectId: context.project.id,
      provider: 'gsc',
      siteUrl: parsed.data.siteUrl,
      credentials: parseAnalyticsCredentials(parsed.data.credentials),
      metadata: {
        connectedBy: context.user.id,
      },
    });

    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Search Console' },
      { status: 500 },
    );
  }
}
