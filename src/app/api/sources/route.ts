import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildSourcesAggregations } from '@/lib/sources/queries';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get('tab') || 'domains') as 'domains' | 'urls';
  const rangeDays = Number(searchParams.get('range') || 30);
  const owned = (searchParams.get('owned') || 'all') as 'all' | 'owned' | 'earned';
  const topicId = searchParams.get('topic') || null;
  const model = searchParams.get('model') || null;
  const search = (searchParams.get('search') || '').toLowerCase();
  const gapOnly = searchParams.get('gap') === 'true';

  const startDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('citations')
    .select('id, cited_at, ai_model, brand_mentioned, competitor_mentioned, position_in_answer, prompt_run_id, topic_id, run:analysis_runs!inner(run_type), domain:sources_domains(domain, domain_type, is_owned), url:sources_urls(url, url_type)')
    .eq('project_id', project.id)
    .eq('run.run_type', 'monitoring')
    .gte('cited_at', startDate)
    .order('cited_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let citations = (data || []) as Array<any>;

  if (topicId) {
    citations = citations.filter((c) => c.topic_id === topicId);
  }
  if (model) {
    citations = citations.filter((c) => c.ai_model === model);
  }
  if (owned === 'owned') {
    citations = citations.filter((c) => c.domain?.is_owned);
  }
  if (owned === 'earned') {
    citations = citations.filter((c) => !c.domain?.is_owned);
  }
  if (search) {
    citations = citations.filter((c) =>
      (tab === 'domains' ? c.domain?.domain : c.url?.url)?.toLowerCase().includes(search)
    );
  }

  const payload = buildSourcesAggregations({
    citations,
    rangeDays,
    tab,
    gapOnly,
  });

  return NextResponse.json(payload);
}
