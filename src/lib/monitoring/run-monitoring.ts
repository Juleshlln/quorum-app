import { queryOpenAI } from '@/lib/ai/providers';
import { ingestCitations } from '@/lib/sources/ingest';

type MonitoringPrompt = {
  id: string;
  prompt_text: string;
  topic_id: string | null;
  project_id: string;
  is_active: boolean | null;
};

type PromptVersion = {
  id: string;
  version_number: number;
  prompt_text: string;
  is_active: boolean;
};

const DEFAULT_MODELS = ['gpt-4o'];

function extractCitations(text: string | null): Array<{ url: string; domain: string }> {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlRegex) || [];
  return urls.map((url) => {
    const domain = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    return { url, domain };
  });
}

function classifyDomain(domain: string): string {
  if (domain.includes('reddit.com') || domain.includes('youtube.com') || domain.includes('tiktok.com')) {
    return 'ugc';
  }
  if (domain.endsWith('.gouv.fr') || domain.endsWith('.gov') || domain.endsWith('.edu')) {
    return 'institutional';
  }
  if (domain.includes('wikipedia.org') || domain.includes('medium.com')) {
    return 'editorial';
  }
  return 'other';
}

export async function runMonitoringForProject({
  supabase,
  projectId,
  brandName,
  competitors,
  context,
  scheduledAt = new Date().toISOString(),
  models = DEFAULT_MODELS,
}: {
  supabase: any;
  projectId: string;
  brandName: string;
  competitors: string[];
  context: string;
  scheduledAt?: string;
  models?: string[];
}) {
  const { data: topicsData } = await supabase
    .from('monitoring_topics')
    .select('id, is_active')
    .eq('project_id', projectId);

  const activeTopicIds = new Set(
    (topicsData || []).filter((t: any) => t.is_active !== false).map((t: any) => t.id)
  );

  const { data: promptsData, error: promptsError } = await supabase
    .from('monitoring_prompts')
    .select('id, prompt_text, topic_id, project_id, is_active')
    .eq('project_id', projectId);

  if (promptsError) {
    throw new Error(promptsError.message);
  }

  const prompts = (promptsData as MonitoringPrompt[] || []).filter((p) => {
    if (p.is_active === false) return false;
    if (p.topic_id && !activeTopicIds.has(p.topic_id)) return false;
    return true;
  });

  if (prompts.length === 0) {
    return { runs: 0, answers: 0 };
  }

  let runs = 0;
  let answers = 0;

  for (const prompt of prompts) {
    let version: PromptVersion | null = null;
    const { data: versionRows } = await supabase
      .from('prompt_versions')
      .select('id, version_number, prompt_text, is_active')
      .eq('prompt_id', prompt.id)
      .eq('is_active', true)
      .limit(1);

    if (versionRows && versionRows.length > 0) {
      version = versionRows[0] as PromptVersion;
    } else {
      const { data: insertedVersion } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: prompt.id,
          version_number: 1,
          prompt_text: prompt.prompt_text,
          is_active: true,
        })
        .select('id, version_number, prompt_text, is_active')
        .single();
      if (insertedVersion) {
        version = insertedVersion as PromptVersion;
      }
    }

    if (!version) continue;

    for (const model of models) {
      const { data: runRow, error: runError } = await supabase
        .from('prompt_runs')
        .insert({
          prompt_id: prompt.id,
          prompt_version_id: version.id,
          project_id: projectId,
          ai_model: model,
          run_type: 'monitoring',
          scheduled_at: scheduledAt,
          executed_at: new Date().toISOString(),
          status: 'success',
        })
        .select('id')
        .single();

      if (runError || !runRow) {
        continue;
      }

      runs += 1;
      const result = await queryOpenAI(version.prompt_text, brandName, competitors, context);
      answers += 1;

      await supabase
        .from('ai_answers')
        .insert({
          prompt_run_id: runRow.id,
          raw_answer_text: result.response,
        });

      const citations = extractCitations(result.response);
      if (citations.length > 0) {
        await ingestCitations({
          supabase,
          projectId,
          promptRunId: runRow.id,
          citations: citations.map((c) => ({
            url: c.url,
            domain: c.domain,
            domain_type: classifyDomain(c.domain),
          })),
          citedAt: scheduledAt,
          aiModel: result.model,
          topicId: prompt.topic_id ?? null,
          brandMentioned: result.mentioned,
          competitorMentioned: result.competitors_mentioned?.length ? true : false,
          positionInAnswer: result.position,
        });
      }
    }
  }

  return { runs, answers };
}
