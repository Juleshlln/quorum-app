import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft, Play, Clock, TrendingUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { StartRunButton } from '@/components/runs/start-run-button';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .single();
  
  return {
    title: project ? `Analyses - ${project.name}` : 'Analyses',
  };
}

export default async function ProjectRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return notFound();
  }

  // Type assertion
  const projectData = project as {
    id: string;
    name: string;
  };

  // Get all runs for this project
  const { data: runs } = await supabase
    .from('runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au projet
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Historique des analyses</h1>
          <p className="text-zinc-400 mt-1">{projectData.name}</p>
        </div>
        <StartRunButton projectId={projectId} projectName={projectData.name} />
      </div>

      {/* Runs list */}
      {runs && runs.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/20 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Visibilité</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Sentiment</th>
                <th className="px-4 py-3 text-right">Score Global</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {runs.map((run) => (
                <tr 
                  key={run.id} 
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/projects/${projectId}/runs/${run.id}`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      {formatDate(run.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300">
                    {run.score_visibility !== null ? `${run.score_visibility}%` : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300">
                    {run.score_accuracy !== null ? `${run.score_accuracy}%` : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300">
                    {run.score_sentiment !== null ? `${run.score_sentiment}%` : '—'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {run.score_overall !== null ? (
                      <span className={`text-sm font-semibold ${
                        run.score_overall >= 70 ? 'text-lime-400' :
                        run.score_overall >= 50 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {run.score_overall}%
                      </span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Play className="w-8 h-8 text-zinc-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Aucune analyse
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Lancez votre première analyse pour voir comment les IA perçoivent votre marque.
          </p>
          <StartRunButton projectId={projectId} projectName={projectData.name} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { 
      icon: <Clock className="w-3.5 h-3.5" />,
      text: 'En attente',
      class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    },
    running: { 
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      text: 'En cours',
      class: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    },
    completed: { 
      icon: <CheckCircle className="w-3.5 h-3.5" />,
      text: 'Terminé',
      class: 'bg-lime-500/10 text-lime-400 border-lime-500/20'
    },
    failed: { 
      icon: <XCircle className="w-3.5 h-3.5" />,
      text: 'Échec',
      class: 'bg-red-500/10 text-red-400 border-red-500/20'
    },
  };

  const { icon, text, class: className } = config[status as keyof typeof config] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border ${className}`}>
      {icon}
      {text}
    </span>
  );
}
