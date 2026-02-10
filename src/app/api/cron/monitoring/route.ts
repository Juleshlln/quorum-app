import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runMonitoringForProject } from '@/lib/monitoring/run-monitoring';

function buildContext(project: any) {
  const contextParts: string[] = [];
  if (project.description) contextParts.push(project.description);
  if (project.location) contextParts.push(`Localisation: ${project.location}`);
  if (project.industry) contextParts.push(`Secteur: ${project.industry}`);
  if (Array.isArray(project.keywords) && project.keywords.length > 0) {
    contextParts.push(`Mots-clés: ${project.keywords.join(', ')}`);
  }
  return contextParts.length > 0 ? `Contexte de la marque: ${contextParts.join('. ')}.` : '';
}

export async function POST(request: NextRequest) {
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const secret = headerSecret || bearerToken;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, location, industry, keywords');

  for (const project of projects || []) {
    const { data: competitorsData } = await supabase
      .from('competitors')
      .select('name')
      .eq('project_id', project.id);

    const competitors = (competitorsData || []).map((c: { name: string }) => c.name);
    const context = buildContext(project);

    await runMonitoringForProject({
      supabase,
      projectId: project.id,
      brandName: project.name,
      competitors,
      context,
      runType: 'monitoring',
    });
  }

  return NextResponse.json({ success: true, mode: 'monitoring' });
}
