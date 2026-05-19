import { NextRequest, NextResponse } from 'next/server';
import { getBusinessImpactMigrationHelp, isBusinessImpactSchemaMissingError } from '@/lib/business-impact/errors';
import { createAdminClient } from '@/lib/supabase/server';
import { getBusinessImpactPages } from '@/lib/business-impact/service';
import { requireActiveProject, resolveDateWindow } from '@/lib/business-impact/request';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const context = await requireActiveProject();
  if (context.error) return context.error;

  try {
    const window = resolveDateWindow(request.url, 30);
    const supabase = createAdminClient();
    const pages = await getBusinessImpactPages({
      supabase,
      projectId: context.project.id,
      projectWebsite: context.project.website,
      startDate: window.startDate,
      endDate: window.endDate,
    });

    return NextResponse.json({
      ok: true,
      window,
      pages,
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
      { error: error instanceof Error ? error.message : 'Failed to load business impact pages' },
      { status: 500 },
    );
  }
}
