import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCompetitiveIntelligenceOverview } from '@/lib/business-impact/service';
import { requireActiveProject, resolveDateWindow } from '@/lib/business-impact/request';
import { isBusinessImpactSchemaMissingError, getBusinessImpactMigrationHelp } from '@/lib/business-impact/errors';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const context = await requireActiveProject();
  if (context.error) return context.error;

  try {
    const window = resolveDateWindow(request.url, 30);
    const supabase = createAdminClient();
    const overview = await getCompetitiveIntelligenceOverview({
      supabase,
      projectId: context.project.id,
      brandName: context.project.name,
      startDate: window.startDate,
      endDate: window.endDate,
    });

    return NextResponse.json({
      ok: true,
      window,
      prompts: overview.promptLevelCompetitiveMap,
    });
  } catch (error) {
    if (isBusinessImpactSchemaMissingError(error)) {
      return NextResponse.json(
        { error: 'Business Impact tables not found. Run the migration first.', migration: getBusinessImpactMigrationHelp() },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load prompt competitive map' },
      { status: 500 },
    );
  }
}
