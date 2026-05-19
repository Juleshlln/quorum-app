import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBusinessImpactMigrationHelp, isBusinessImpactSchemaMissingError } from '@/lib/business-impact/errors';
import { createAdminClient } from '@/lib/supabase/server';
import { getAttributionEvents } from '@/lib/business-impact/service';
import { requireActiveProject, resolveDateWindow } from '@/lib/business-impact/request';
import { syncBusinessImpactForProject } from '@/lib/business-impact/sync';
import type { AnalyticsProvider } from '@/lib/business-impact/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const refreshSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.number().int().positive().optional(),
  providers: z.array(z.enum(['ga4', 'gsc', 'matomo'])).optional(),
});

function resolveBodyWindow(requestUrl: string, body: z.infer<typeof refreshSchema>) {
  if (body.startDate && body.endDate) {
    return {
      startDate: body.startDate,
      endDate: body.endDate,
      days: body.days || 30,
    };
  }

  const url = new URL(requestUrl);
  if (body.days) {
    url.searchParams.set('days', String(body.days));
  }
  return resolveDateWindow(url.toString(), body.days || 30);
}

export async function GET(request: NextRequest) {
  const context = await requireActiveProject();
  if (context.error) return context.error;

  try {
    const window = resolveDateWindow(request.url, 30);
    const supabase = createAdminClient();
    const events = await getAttributionEvents({
      supabase,
      projectId: context.project.id,
      projectWebsite: context.project.website,
      startDate: window.startDate,
      endDate: window.endDate,
    });

    return NextResponse.json({
      ok: true,
      window,
      events,
    });
  } catch (error) {
    if (isBusinessImpactSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error: 'Business Impact schema is not applied yet',
          migrationRequired: true,
          ...getBusinessImpactMigrationHelp(),
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load attribution events' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await requireActiveProject();
  if (context.error) return context.error;

  const body = await request.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid attribution refresh payload' }, { status: 400 });
  }

  try {
    const window = resolveBodyWindow(request.url, parsed.data);
    const supabase = createAdminClient();
    const result = await syncBusinessImpactForProject({
      supabase,
      project: {
        projectId: context.project.id,
        projectName: context.project.name,
        projectWebsite: context.project.website,
        projectKeywords: context.project.keywords || [],
      },
      startDate: window.startDate,
      endDate: window.endDate,
      providers: parsed.data.providers as AnalyticsProvider[] | undefined,
    });

    return NextResponse.json({
      ok: true,
      window,
      ...result,
    });
  } catch (error) {
    if (isBusinessImpactSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error: 'Business Impact schema is not applied yet',
          migrationRequired: true,
          ...getBusinessImpactMigrationHelp(),
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to recompute attribution' },
      { status: 500 },
    );
  }
}
