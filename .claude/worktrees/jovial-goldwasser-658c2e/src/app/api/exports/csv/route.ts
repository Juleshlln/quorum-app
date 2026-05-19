import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export const runtime = 'nodejs';
export const maxDuration = 60;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const projectId = project.id;

  const start30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  // Fetch citations with joined data (non-fallback only)
  const { data: citations } = await supabase
    .from('citations')
    .select(`
      id,
      cited_at,
      ai_model,
      method,
      confidence,
      brand_mentioned,
      competitor_mentioned,
      position_in_answer,
      is_fallback,
      prompt_run_id,
      domain:sources_domains(domain, category, is_owned),
      url:sources_urls(url)
    `)
    .eq('project_id', projectId)
    .eq('is_fallback', false)
    .gte('cited_at', `${start30}T00:00:00Z`)
    .order('cited_at', { ascending: false });

  if (!citations || citations.length === 0) {
    const headers = [
      'Date', 'Prompt', 'Modele IA', 'URL citee', 'Domaine',
      'Categorie', 'Marque mentionnee', 'Sentiment', 'Position',
    ];
    const csv = '\uFEFF' + headers.join(',') + '\n';
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="quorum-audit-${today}.csv"`,
      },
    });
  }

  // Get prompt_run details for these citations
  type PromptRunRow = { id: string; prompt_id: string; ai_model: string | null; sentiment_label: string | null; position_rank: number | null; brand_mentioned: boolean | null };
  const promptRunIds = [...new Set(citations.map((c: any) => c.prompt_run_id).filter(Boolean))];

  const { data: promptRuns } = promptRunIds.length > 0
    ? await supabase
        .from('prompt_runs')
        .select('id, prompt_id, ai_model, sentiment_label, position_rank, brand_mentioned')
        .in('id', promptRunIds)
    : { data: [] as any[] };

  const promptRunMap = new Map<string, PromptRunRow>(
    ((promptRuns || []) as PromptRunRow[]).map((pr) => [pr.id, pr])
  );

  // Get prompt texts
  const promptIds = [...new Set((promptRuns || []).map((pr: any) => pr.prompt_id).filter(Boolean))];
  const { data: prompts } = promptIds.length > 0
    ? await supabase
        .from('monitoring_prompts')
        .select('id, prompt_text')
        .in('id', promptIds)
    : { data: [] as any[] };

  const promptTextMap = new Map((prompts || []).map((p: any) => [p.id, p.prompt_text]));

  // Build CSV rows
  const headers = [
    'Date', 'Prompt', 'Modele IA', 'URL citee', 'Domaine',
    'Categorie', 'Marque mentionnee', 'Sentiment', 'Position',
  ];

  const rows: string[][] = [];
  for (const c of citations as any[]) {
    const pr = promptRunMap.get(c.prompt_run_id);
    const promptText = pr ? (promptTextMap.get(pr.prompt_id) || '') : '';
    const domain = c.domain as { domain: string; category: string | null; is_owned: boolean } | null;
    const url = c.url as { url: string } | null;

    const categoryLabel = domain?.category === 'owned'
      ? 'Owned'
      : domain?.category === 'competitor'
        ? 'Concurrent'
        : 'Tiers';

    rows.push([
      c.cited_at ? new Date(c.cited_at).toLocaleDateString('fr-FR') : '',
      promptText,
      c.ai_model || pr?.ai_model || '',
      url?.url || '',
      domain?.domain || '',
      categoryLabel,
      c.brand_mentioned ? 'Oui' : 'Non',
      pr?.sentiment_label === 'positive' ? 'Positif'
        : pr?.sentiment_label === 'negative' ? 'Negatif'
        : pr?.sentiment_label === 'neutral' ? 'Neutre'
        : '',
      c.position_in_answer != null ? String(c.position_in_answer) : (pr?.position_rank != null ? String(pr.position_rank) : ''),
    ]);
  }

  // BOM + CSV
  const csv = '\uFEFF' + headers.join(',') + '\n' + rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quorum-audit-${today}.csv"`,
    },
  });
}
