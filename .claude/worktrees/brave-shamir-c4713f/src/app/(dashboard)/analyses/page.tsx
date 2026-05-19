import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { StartRunButton } from '@/components/runs/start-run-button';

export const metadata = {
  title: 'Analyses | Quorum',
};

export default async function AnalysesPage() {
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
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  const { data: analysesData } = await supabase
    .from('analyses')
    .select('id, status, created_at, analysis_mode, objectives')
    .eq('project_id', project.id)
    .eq('kind', 'sandbox')
    .order('created_at', { ascending: false })
    .limit(10);

  const analyses = (analysesData || []) as Array<{
    id: string;
    status: string;
    created_at: string;
    analysis_mode: string;
    objectives: string[] | null;
  }>;

  return (
    <div className="space-y-6">
      <div className="quorum-panel-strong flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="quorum-kicker">Analyses</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] quorum-text-primary">Lancez des analyses manuelles</h1>
          <p className="mt-2 text-sm quorum-text-muted">
            Bac à sable pour lancer des analyses manuelles.
          </p>
        </div>
        <StartRunButton
          projectId={project.id}
          projectName={project.name}
          projectIndustry={project.industry}
          projectLocation={project.location}
          projectDescription={project.description}
        />
      </div>

      {analyses.length === 0 ? (
        <div className="quorum-panel p-10 text-center quorum-text-muted">
          Aucune analyse manuelle pour le moment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border quorum-border-default quorum-surface-strong backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead className="quorum-surface quorum-text-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Mode</th>
                <th className="text-left px-4 py-3 font-medium">Objectifs</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => (
                <tr key={a.id} className="border-t quorum-border-default transition-colors hover:quorum-surface">
                  <td className="px-4 py-3 quorum-text-primary">
                    {new Date(a.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 quorum-text-primary">
                    {a.analysis_mode === 'trend' ? 'Tendance IA' : 'Simulation'}
                  </td>
                  <td className="px-4 py-3 quorum-text-muted">
                    {(a.objectives || []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 quorum-text-muted">{a.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/projects/${project.id}/runs/${a.id}`}
                      className="text-sm quorum-text-muted hover:quorum-text-primary"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
