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
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Analyses</h1>
          <p className="text-zinc-400 mt-1">
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
        <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
          Aucune analyse manuelle pour le moment.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-400">
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
                <tr key={a.id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3 text-zinc-200">
                    {new Date(a.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">
                    {a.analysis_mode === 'trend' ? 'Tendance IA' : 'Simulation'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {(a.objectives || []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{a.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/projects/${project.id}/runs/${a.id}`}
                      className="text-cyan-300 text-sm hover:text-cyan-200"
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
