import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function normalizeDomain(website?: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const accepted = Array.isArray(body?.accepted) ? body.accepted : [];

  const admin = createAdminClient();
  const rows = accepted.map((c: any) => ({
    project_id: projectId,
    name: String(c.name || '').trim(),
    website: c.website || null,
    domain: normalizeDomain(c.website || c.domain || null),
    description: c.description || null,
    confidence: typeof c.confidence === 'number' ? c.confidence : null,
    method: c.method || 'manual',
    evidence: c.evidence || [],
    updated_at: new Date().toISOString(),
  })).filter((c: any) => c.name);

  if (rows.length > 0) {
    await admin.from('competitors').upsert(rows, {
      onConflict: 'project_id,domain',
    });
  }

  if (Array.isArray(body?.suggestionIds) && body.suggestionIds.length > 0) {
    await admin
      .from('competitor_suggestions')
      .update({ status: 'accepted' })
      .in('id', body.suggestionIds);
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
