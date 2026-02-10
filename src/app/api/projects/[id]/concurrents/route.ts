import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ConcurrentPayload = {
  id?: string;
  nom?: string;
  domaine?: string | null;
  alias?: string[] | null;
  type_concurrence?: string | null;
  score_proximite?: number | null;
  justification?: any;
  type_detection?: 'auto' | 'manuel';
  verrouille?: boolean;
};

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(input).replace(/^www\./, '').toLowerCase();
  }
}

async function getProjectForUser(projectId: string, userId: string) {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== userId) {
    return null;
  }
  return project;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const project = await getProjectForUser(projectId, user.id);
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('concurrents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ concurrents: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const project = await getProjectForUser(projectId, user.id);
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as ConcurrentPayload;
  const nom = String(body.nom || '').trim();
  if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });

  const domaine = normalizeDomain(body.domaine ? String(body.domaine).trim() : null);
  if (domaine) {
    const { data: existingDomain } = await supabase
      .from('concurrents')
      .select('id')
      .eq('project_id', projectId)
      .eq('domaine', domaine)
      .maybeSingle();
    if (existingDomain) {
      return NextResponse.json(
        { error: 'Un concurrent avec ce domaine existe déjà.' },
        { status: 409 }
      );
    }
  }

  const insertRow = {
    project_id: projectId,
    nom,
    domaine,
    alias: Array.isArray(body.alias) ? body.alias.filter(Boolean) : [],
    type_concurrence: body.type_concurrence ? String(body.type_concurrence).trim() : null,
    type_detection: body.type_detection === 'auto' ? 'auto' : 'manuel',
    score_proximite: typeof body.score_proximite === 'number' ? body.score_proximite : 50,
    justification: body.justification ?? null,
    verrouille: Boolean(body.verrouille),
  };

  const { data, error } = await supabase
    .from('concurrents')
    .insert(insertRow)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ concurrent: data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const project = await getProjectForUser(projectId, user.id);
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as ConcurrentPayload;
  if (!body.id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const updates: Record<string, any> = {};
  if (typeof body.nom === 'string') updates.nom = body.nom.trim();
  if (typeof body.domaine !== 'undefined') {
    updates.domaine = normalizeDomain(body.domaine ? String(body.domaine).trim() : null);
  }
  if (typeof body.alias !== 'undefined') {
    updates.alias = Array.isArray(body.alias) ? body.alias.filter(Boolean) : [];
  }
  if (typeof body.type_concurrence !== 'undefined') {
    updates.type_concurrence = body.type_concurrence ? String(body.type_concurrence).trim() : null;
  }
  if (typeof body.score_proximite === 'number') updates.score_proximite = body.score_proximite;
  if (typeof body.justification !== 'undefined') updates.justification = body.justification ?? null;
  if (typeof body.verrouille === 'boolean') updates.verrouille = body.verrouille;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('concurrents')
    .update(updates)
    .eq('id', body.id)
    .eq('project_id', projectId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ concurrent: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  const project = await getProjectForUser(projectId, user.id);
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as ConcurrentPayload;
  if (!body.id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const { data: current, error: currentError } = await supabase
    .from('concurrents')
    .select('id, verrouille')
    .eq('id', body.id)
    .eq('project_id', projectId)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }

  if (current.verrouille) {
    return NextResponse.json({ error: 'Concurrent verrouillé' }, { status: 409 });
  }

  const { error } = await supabase
    .from('concurrents')
    .delete()
    .eq('id', body.id)
    .eq('project_id', projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
