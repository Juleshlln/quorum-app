import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
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
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const body = await request.json().catch(() => ({}));
  const bodyToken = typeof body?.token === 'string' ? body.token.trim() : null;
  const fallbackToken = token || bodyToken;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production' && fallbackToken) {
      // Dev fallback: allow local testing when CRON_SECRET is not loaded.
    } else {
      return NextResponse.json({ error: 'CRON_SECRET missing' }, { status: 500 });
    }
  }
  if (secret && token !== secret && bodyToken !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = body?.project_id ? String(body.project_id) : null;
  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  const overrideUrl = typeof body?.supabase_url === 'string' ? body.supabase_url.trim() : '';
  const overrideKey = typeof body?.service_role_key === 'string' ? body.service_role_key.trim() : '';

  const supabase =
    envUrl && envKey
      ? createAdminClient()
      : process.env.NODE_ENV !== 'production' && overrideUrl && overrideKey
        ? createServerClient<Database, 'public'>(overrideUrl, overrideKey, {
            cookies: {
              getAll() {
                return [];
              },
              setAll() {
                // no-op
              },
            },
          })
        : null;

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase URL or Service Role Key missing' },
      { status: 500 }
    );
  }
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, description, location, industry, keywords')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: error?.message || 'Project not found' }, { status: 404 });
  }

  const { data: competitorsRows } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', project.id);
  const competitors = (competitorsRows || []).map((row: { name: string }) => row.name);
  const context = buildContext(project);
  const summary = await runMonitoringForProject({
    supabase,
    projectId: project.id,
    brandName: project.name,
    competitors,
    context,
    runType: 'sandbox',
  });

  return NextResponse.json({ ok: true, ...summary });
}
