import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncBusinessImpactForProject } from '@/lib/business-impact/sync';
import { resolveDateWindow } from '@/lib/business-impact/request';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const secret = headerSecret || bearerToken;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const window = resolveDateWindow(request.url, 30);
    const supabase = createAdminClient();

    const { data: connections, error: connectionsError } = await supabase
      .from('analytics_connections')
      .select('project_id')
      .eq('status', 'active');

    if (connectionsError) {
      throw new Error(connectionsError.message);
    }

    const projectIds = Array.from(new Set((connections || []).map((row: any) => row.project_id).filter(Boolean)));
    if (projectIds.length === 0) {
      return NextResponse.json({ ok: true, processed: [] });
    }

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, website, keywords')
      .in('id', projectIds);

    if (projectsError) {
      throw new Error(projectsError.message);
    }

    const BATCH_SIZE = 5;
    const projectList = projects || [];
    const processed = [];

    for (let i = 0; i < projectList.length; i += BATCH_SIZE) {
      const batch = projectList.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((project: any) =>
          syncBusinessImpactForProject({
            supabase,
            project: {
              projectId: project.id,
              projectName: project.name,
              projectWebsite: project.website,
              projectKeywords: project.keywords || [],
            },
            startDate: window.startDate,
            endDate: window.endDate,
          }).then((result) => ({
            projectId: project.id,
            projectName: project.name,
            ...result,
          })),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          processed.push(result.value);
        } else {
          const project = batch[results.indexOf(result)];
          console.error(`[business-impact-cron] failed for project ${project?.id}`, result.reason);
          processed.push({
            projectId: project?.id,
            projectName: project?.name,
            error: result.reason instanceof Error ? result.reason.message : 'Sync failed',
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      window,
      processed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Business impact cron failed' },
      { status: 500 },
    );
  }
}
