import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { MonitoringPromptsClient } from '@/components/monitoring/prompts-client';

export const metadata = {
  title: 'Prompts | Quorum',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Prompts</h1>
        <p className="text-zinc-400 mt-1">
          Configure ce qui est monitoré automatiquement chaque jour.
        </p>
      </div>
      <MonitoringPromptsClient
        projectId={project.id}
        topics={(topicsData || []) as Array<{ id: string; name: string; is_active: boolean }>}
        prompts={(promptsData || []) as Array<{ id: string; prompt_text: string; is_active: boolean; source: string; topic_id: string | null }>}
      />
    </div>
  );
}
