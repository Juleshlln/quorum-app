import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { MonitoringTopics } from '@/components/monitoring/monitoring-topics';

export const metadata = {
  title: 'Monitoring | Quorum',
};

export default async function PromptsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Veuillez vous connecter.</p>
      </div>
    );
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  const { data: topicsData } = await supabase
    .from('monitoring_topics')
    .select('id, name, is_active')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  const { data: promptsData } = await supabase
    .from('monitoring_prompts')
    .select('id, prompt_text, is_active, source, topic_id')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  const { data: templatesData } = await supabase
    .from('prompt_templates')
    .select('id, title, prompt_text, primary_objective, secondary_objectives, topic_slug, is_default_monitoring')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  const now = new Date();
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: topicMetricsData } = await supabase
    .from('topic_daily_metrics')
    .select('topic_id, date, visibility_rate')
    .eq('project_id', project.id)
    .gte('date', start7)
    .order('date', { ascending: true });

  const topicDeltasMap = new Map<string, number | null>();
  (topicMetricsData || []).forEach((row: { topic_id: string; date: string; visibility_rate: number | null }) => {
    const existing = topicDeltasMap.get(row.topic_id);
    if (existing === undefined) {
      topicDeltasMap.set(row.topic_id, row.visibility_rate ?? null);
    } else if (row.visibility_rate !== null) {
      topicDeltasMap.set(row.topic_id, (row.visibility_rate ?? 0) - (existing ?? 0));
    }
  });

  const topicDeltas = (topicsData || []).map((t: { id: string }) => ({
    topic_id: t.id,
    delta: topicDeltasMap.get(t.id) ?? null,
  }));

  return (
    <MonitoringTopics
      projectId={project.id}
      topics={(topicsData || []) as Array<{ id: string; name: string; description?: string | null; is_active: boolean }>}
      questions={(promptsData || []) as Array<{ id: string; prompt_text: string; is_active: boolean; source: string; topic_id: string | null; country?: string | null; language?: string | null; intent?: string | null; tags?: string[] | null }>}
      templates={(templatesData || []) as Array<{ id: string; prompt_text: string; topic_slug?: string | null }>}
    />
  );
}
