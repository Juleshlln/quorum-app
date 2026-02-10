import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { detectCompetitors } from '@/lib/competitors/detect-competitors';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id, name, website, industry, location')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const suggestions = await detectCompetitors({
    brandName: project.name,
    website: project.website,
    industry: project.industry,
    country: project.location,
    language: 'fr',
  });

  const admin = createAdminClient();
  if (suggestions.length > 0) {
    const rows = suggestions.map((c) => ({
      project_id: projectId,
      name: c.name,
      website: c.website || null,
      domain: c.domain || null,
      description: c.description || null,
      confidence: c.confidence ?? null,
      method: c.method || 'llm_synthesis',
      evidence: c.evidence || [],
      status: 'suggested',
    }));
    await admin.from('competitor_suggestions').upsert(rows, {
      onConflict: 'project_id,domain',
    });
  }

  return NextResponse.json({ suggestions });
}
