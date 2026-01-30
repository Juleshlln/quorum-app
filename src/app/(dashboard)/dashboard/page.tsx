import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, FolderOpen, Play, TrendingUp, ArrowRight, ArrowUpRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { StatsOverview } from '@/components/charts/stats-overview';
import { ScoreChart } from '@/components/charts/score-chart';

export const metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // Get user projects with runs
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      runs (
        id,
        status,
        score_overall,
        score_visibility,
        score_accuracy,
        score_sentiment,
        created_at
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  // Get all completed runs for stats
  const { data: allRuns } = await supabase
    .from('runs')
    .select(`
      id,
      status,
      score_overall,
      created_at,
      project:projects!inner (
        user_id
      )
    `)
    .eq('project.user_id', user!.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  // Calculate stats
  const totalProjects = projects?.length || 0;
  const totalRuns = allRuns?.length || 0;
  
  const completedRuns = allRuns?.filter(r => r.score_overall !== null) || [];
  const avgScore = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((sum, r) => sum + (r.score_overall || 0), 0) / completedRuns.length)
    : null;
  
  const successRate = totalRuns > 0
    ? Math.round((completedRuns.length / totalRuns) * 100)
    : 100;

  // Prepare chart data (last 10 runs)
  const chartData = (allRuns || [])
    .filter(r => r.score_overall !== null)
    .slice(-10)
    .map(run => ({
      date: new Date(run.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      score: run.score_overall || 0,
      label: new Date(run.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    }));

  // Get recent runs for activity feed
  const { data: recentRuns } = await supabase
    .from('runs')
    .select(`
      *,
      project:projects (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  const hasProjects = projects && projects.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-1">
            Bienvenue ! Gérez vos projets et analysez votre visibilité IA.
          </p>
        </div>
        <Link 
          href="/projects/new" 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau projet
        </Link>
      </div>

      {/* Empty state */}
      {!hasProjects && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="w-8 h-8 text-zinc-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Créez votre premier projet
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Un projet représente une marque ou entreprise que vous souhaitez analyser. 
            Commencez par créer votre premier projet pour lancer une analyse.
          </p>
          <Link 
            href="/projects/new" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un projet
          </Link>
        </div>
      )}

      {/* Content with projects */}
      {hasProjects && (
        <>
          {/* Stats Overview */}
          <StatsOverview
            totalProjects={totalProjects}
            totalRuns={totalRuns}
            avgScore={avgScore}
            successRate={successRate}
          />

          {/* Charts and Activity Row */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Score Evolution Chart */}
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-zinc-900/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-medium text-white">Évolution du score</h2>
                <span className="text-xs text-zinc-500">10 dernières analyses</span>
              </div>
              {chartData.length > 0 ? (
                <ScoreChart data={chartData} height={180} />
              ) : (
                <div className="h-[180px] flex items-center justify-center text-zinc-500 text-sm">
                  Lancez une analyse pour voir l'évolution
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-white/10 bg-zinc-900/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h2 className="font-medium text-white">Activité récente</h2>
              </div>
              <div className="p-4 space-y-4">
                {recentRuns && recentRuns.length > 0 ? (
                  recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      href={`/projects/${run.project?.id}/runs/${run.id}`}
                      className="flex items-start gap-3 group"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        run.status === 'completed' ? 'bg-lime-500/10 border border-lime-500/20' :
                        run.status === 'running' ? 'bg-blue-500/10 border border-blue-500/20' :
                        run.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' : 
                        'bg-zinc-800 border border-zinc-700'
                      }`}>
                        {run.status === 'completed' ? (
                          <TrendingUp className="w-4 h-4 text-lime-400" />
                        ) : run.status === 'running' ? (
                          <Play className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Play className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate group-hover:text-lime-400 transition-colors">
                          {run.project?.name || 'Projet'}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {run.status === 'completed' ? 'Terminée' :
                           run.status === 'running' ? 'En cours' :
                           run.status === 'failed' ? 'Échec' : 'En attente'}
                          {' • '}
                          {formatDate(run.created_at)}
                        </p>
                      </div>
                      {run.score_overall !== null && (
                        <span className={`text-xs font-medium ${
                          run.score_overall >= 70 ? 'text-lime-400' : 
                          run.score_overall >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {run.score_overall}%
                        </span>
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    Aucune activité récente
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Projects Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-white">Mes projets</h2>
              <Link 
                href="/projects" 
                className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                Voir tout
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects?.slice(0, 6).map((project) => {
                const completedRuns = project.runs?.filter((r: any) => r.status === 'completed') || [];
                const lastRun = completedRuns[0];
                const previousRun = completedRuns[1];
                
                const scoreDiff = lastRun?.score_overall !== null && previousRun?.score_overall !== null
                  ? lastRun.score_overall - previousRun.score_overall
                  : null;

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group p-5 rounded-xl border border-white/10 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                        <span className="text-white font-semibold text-lg">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <h3 className="font-semibold text-white mb-1 group-hover:text-lime-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      {project.industry || 'Secteur non défini'}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                      <span className="text-xs text-zinc-500">
                        {project.runs?.length || 0} analyse{(project.runs?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {scoreDiff !== null && scoreDiff !== 0 && (
                          <span className={`text-xs ${scoreDiff > 0 ? 'text-lime-400' : 'text-red-400'}`}>
                            {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                          </span>
                        )}
                        {lastRun?.score_overall !== null && lastRun?.score_overall !== undefined ? (
                          <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                            lastRun.score_overall >= 70 
                              ? 'bg-lime-400/10 text-lime-400' 
                              : lastRun.score_overall >= 50 
                              ? 'bg-yellow-400/10 text-yellow-400'
                              : 'bg-red-400/10 text-red-400'
                          }`}>
                            {lastRun.score_overall}%
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
