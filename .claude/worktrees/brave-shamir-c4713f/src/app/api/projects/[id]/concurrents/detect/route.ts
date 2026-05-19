import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectConcurrents } from '@/lib/concurrents/detect-concurrents';

function normalizeName(input: string) {
  return input.trim().toLowerCase();
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id, name, website, industry, description, keywords')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const suggestions = await detectConcurrents({
    brandName: project.name,
    website: project.website,
    industry: project.industry,
    description: project.description,
    keywords: project.keywords,
  });

  if (!suggestions.length) {
    return NextResponse.json({ inserted: 0, suggestions: [] });
  }

  const { data: existing } = await supabase
    .from('concurrents')
    .select('nom, domaine')
    .eq('project_id', projectId);

  const existingNames = new Set((existing || []).map((c: any) => normalizeName(c.nom)));
  const existingDomains = new Set(
    (existing || [])
      .map((c: any) => (c.domaine ? String(c.domaine).toLowerCase() : null))
      .filter(Boolean) as string[]
  );

  const rows = suggestions
    .filter((s) => {
      if (existingNames.has(normalizeName(s.nom))) return false;
      if (s.domaine && existingDomains.has(s.domaine.toLowerCase())) return false;
      return true;
    })
    .map((s) => ({
      project_id: projectId,
      nom: s.nom,
      domaine: s.domaine || null,
      alias: [],
      type_detection: 'auto',
      score_proximite: s.score_proximite,
      justification: s.justification ?? null,
      verrouille: false,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, suggestions });
  }

  const { data: inserted, error } = await supabase
    .from('concurrents')
    .insert(rows)
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: inserted?.length || 0, suggestions });
}
