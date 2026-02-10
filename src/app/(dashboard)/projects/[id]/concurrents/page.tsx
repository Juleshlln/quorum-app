import { createClient } from '@/lib/supabase/server';
import { ConcurrentsPage } from '@/components/concurrents/concurrents-page';

export const metadata = {
  title: 'Concurrents | Quorum',
};

type ConcurrentRow = {
  id: string;
  project_id: string;
  nom: string;
  domaine: string | null;
  alias: string[] | null;
  type_detection: 'auto' | 'manuel';
  score_proximite: number;
  justification: any | null;
  verrouille: boolean;
  created_at: string;
};

export default async function ProjectConcurrentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Veuillez vous connecter.</p>
      </div>
    );
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id, name')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-10 text-center text-red-300">
        Projet introuvable ou accès refusé.
      </div>
    );
  }

  const { data: concurrentsData } = await supabase
    .from('concurrents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return (
    <ConcurrentsPage
      projectId={projectId}
      projectName={project.name}
      initialConcurrents={(concurrentsData || []) as ConcurrentRow[]}
    />
  );
}
