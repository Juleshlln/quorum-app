import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

function buildSnippet(text: string, needle: string) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx === -1) return text.slice(0, 240);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + needle.length + 160);
  return text.slice(start, end);
}

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
  const scope = (searchParams.get('scope') || 'domain') as 'domain' | 'url';
  const key = searchParams.get('key') || '';

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('citations')
    .select('id, cited_at, ai_model, method, confidence, rationale, prompt_run_id, response_id, domain:sources_domains(domain), url:sources_urls(url), run:prompt_runs!citations_prompt_run_id_fkey(prompt_id, prompt_version_id, ai_model, scheduled_at)')
    .eq('project_id', project.id)
    .order('cited_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = (data || []).filter((row: any) => {
    if (scope === 'domain') return row.domain?.domain === key;
    return row.url?.url === key;
  });

  const responseIds = Array.from(new Set(filtered.map((r: any) => r.response_id).filter(Boolean)));
  let responsesMap = new Map<string, any>();
  if (responseIds.length > 0) {
    const { data: responses } = await supabase
      .from('monitoring_responses')
      .select('id, raw_text, prompt_final, model_used, created_at')
      .in('id', responseIds);
    responsesMap = new Map((responses || []).map((r: any) => [r.id, r]));
  }

  const promptIds = Array.from(new Set(filtered.map((r: any) => r.run?.prompt_id).filter(Boolean)));
  let promptMap = new Map<string, any>();
  if (promptIds.length > 0) {
    const { data: prompts } = await supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, topic_id')
      .in('id', promptIds);
    promptMap = new Map((prompts || []).map((p: any) => [p.id, p]));
  }

  const responseUrlsMap = new Map<string, string[]>();
  for (const row of filtered) {
    if (!row.response_id || !row.url?.url) continue;
    const existing = responseUrlsMap.get(row.response_id) || [];
    if (!existing.includes(row.url.url)) existing.push(row.url.url);
    responseUrlsMap.set(row.response_id, existing);
  }

  const items = filtered.map((row: any) => {
    const resp = row.response_id ? responsesMap.get(row.response_id) : null;
    const prompt = row.run?.prompt_id ? promptMap.get(row.run.prompt_id) : null;
    const needle = scope === 'domain' ? row.domain?.domain : row.url?.url;
    const snippet = resp?.raw_text && needle ? buildSnippet(resp.raw_text, needle) : null;
    return {
      id: row.id,
      cited_at: row.cited_at,
      method: row.method,
      confidence: row.confidence,
      rationale: row.rationale,
      ai_model: row.ai_model,
      prompt_text: prompt?.prompt_text || resp?.prompt_final || null,
      response_snippet: snippet,
      response_id: row.response_id,
      source_urls: row.response_id ? (responseUrlsMap.get(row.response_id) || []) : (row.url?.url ? [row.url.url] : []),
    };
  });

  return NextResponse.json({ scope, key, items });
}
