import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { 
  ArrowLeft, 
  Settings, 
  Play, 
  Globe, 
  Calendar,
  Target,
  Users,
  TrendingUp,
  BarChart3,
  Zap
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DeleteProjectButton } from '@/components/projects/delete-project-button';
import { StartRunButton } from '@/components/runs/start-run-button';
import { ScoreChart } from '@/components/charts/score-chart';
import { MetricsBreakdown } from '@/components/charts/metrics-breakdown';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .single();
  
  return {
    title: project?.name || 'Projet',
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get project with related data
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      competitors (*),
      runs (
        id,
        status,
        score_overall,
        score_visibility,
        score_accuracy,
        score_sentiment,
        created_at
      ),
      prompt_templates (*)
    `)
    .eq('id', id)
    .single();

  if (error || !project) {
    notFound();
  }

  const lastRun = project.runs?.[0];
  const runCount = project.runs?.length || 0;
  const competitorCount = project.competitors?.length || 0;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux projets
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-xl">
              {project.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-zinc-400">
              {project.website && (
                <a 
                  href={project.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  {project.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {project.industry && (
                <span className="flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  {project.industry}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Créé le {formatDate(project.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${project.id}/edit`}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Modifier
          </Link>
          <StartRunButton projectId={project.id} projectName={project.name} />
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-zinc-400 max-w-3xl">{project.description}</p>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Analyses"
          value={runCount.toString()}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Concurrents"
          value={competitorCount.toString()}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Dernier score"
          value={lastRun?.score_overall !== null && lastRun?.score_overall !== undefined 
            ? `${lastRun.score_overall}%` 
            : '—'}
          highlight={lastRun?.score_overall !== null}
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="Prompts"
          value={(project.prompt_templates?.length || 0).toString()}
        />
      </div>

      {/* Score Evolution & Metrics */}
      {runCount > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Score Evolution Chart */}
          <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-6">
            <h2 className="text-sm font-medium text-white uppercase tracking-wider mb-4">
              Évolution du score
            </h2>
            <ScoreChart 
              data={(project.runs || [])
                .filter((r: any) => r.score_overall !== null)
                .slice(0, 10)
                .reverse()
                .map((r: any) => ({
                  date: new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                  score: r.score_overall,
                  label: new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                }))}
              height={160}
            />
          </div>

          {/* Metrics Breakdown */}
          <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-6">
            <h2 className="text-sm font-medium text-white uppercase tracking-wider mb-4">
              Détail des scores
            </h2>
            <MetricsBreakdown 
              current={{
                visibility: lastRun?.score_visibility ?? null,
                accuracy: lastRun?.score_accuracy ?? null,
                sentiment: lastRun?.score_sentiment ?? null,
                overall: lastRun?.score_overall ?? null,
              }}
              previous={project.runs?.[1] ? {
                visibility: project.runs[1].score_visibility ?? null,
                accuracy: project.runs[1].score_accuracy ?? null,
                sentiment: project.runs[1].score_sentiment ?? null,
                overall: project.runs[1].score_overall ?? null,
              } : undefined}
            />
          </div>
        </div>
      )}

      {/* Keywords */}
      {project.keywords && project.keywords.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white uppercase tracking-wider mb-3">
            Mots-clés
          </h2>
          <div className="flex flex-wrap gap-2">
            {project.keywords.map((keyword: string) => (
              <span
                key={keyword}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Competitors */}
      {project.competitors && project.competitors.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white uppercase tracking-wider mb-3">
            Concurrents ({project.competitors.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {project.competitors.map((competitor: any) => (
              <div
                key={competitor.id}
                className="p-4 rounded-lg border border-white/10 bg-zinc-900/20"
              >
                <h3 className="font-medium text-white">{competitor.name}</h3>
                {competitor.website && (
                  <a
                    href={competitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    {competitor.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">
            Analyses récentes
          </h2>
          {runCount > 0 && (
            <Link
              href={`/projects/${project.id}/runs`}
              className="text-sm text-lime-400 hover:text-lime-300 transition-colors"
            >
              Voir tout
            </Link>
          )}
        </div>

        {runCount === 0 ? (
          <div className="rounded-lg border border-white/10 bg-zinc-900/20 p-8 text-center">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="w-5 h-5 text-zinc-500" />
            </div>
            <h3 className="text-white font-medium mb-2">Aucune analyse</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Lancez votre première analyse pour voir comment les IA perçoivent votre marque.
            </p>
            <StartRunButton projectId={project.id} projectName={project.name} />
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-zinc-900/20 overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Visibilité</th>
                  <th className="px-4 py-3">Précision</th>
                  <th className="px-4 py-3">Sentiment</th>
                  <th className="px-4 py-3 text-right">Score global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {project.runs?.slice(0, 5).map((run: any) => (
                  <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {formatDate(run.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {run.score_visibility ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {run.score_accuracy ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {run.score_sentiment ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {run.score_overall !== null ? (
                        <span className={`text-sm font-medium ${
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
        )}
      </div>

      {/* Danger Zone */}
      <div className="pt-8 border-t border-zinc-800">
        <h2 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-4">
          Zone dangereuse
        </h2>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Supprimer le projet</h3>
            <p className="text-zinc-400 text-sm">
              Cette action est irréversible. Toutes les données seront perdues.
            </p>
          </div>
          <DeleteProjectButton projectId={project.id} projectName={project.name} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  highlight 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="p-4 rounded-lg border border-white/10 bg-zinc-900/20">
      <div className="flex items-center gap-2 text-zinc-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-semibold ${highlight ? 'text-lime-400' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const labels = {
    pending: 'En attente',
    running: 'En cours',
    completed: 'Terminé',
    failed: 'Échec',
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${styles[status as keyof typeof styles] || styles.pending}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}
