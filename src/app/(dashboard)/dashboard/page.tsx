import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, FolderOpen, TrendingUp, ArrowRight, ArrowUpRight, Zap, Target } from 'lucide-react';

export const metadata = {
  title: 'Dashboard | Quorum',
};

// Helper function pour formater la date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Types
type Run = {
  id: string;
  status: string;
  score_overall: number | null;
  score_visibility: number | null;
  score_accuracy: number | null;
  score_sentiment: number | null;
  created_at: string;
  project?: { id: string; name: string } | null;
};

type Project = {
  id: string;
  name: string;
  industry: string | null;
  runs: Run[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Veuillez vous connecter.</p>
      </div>
    );
  }
  
  // Get user projects with runs
  const { data: projectsData } = await supabase
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
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const projects = (projectsData as Project[] | null) || [];

  // Get all completed runs for stats
  const { data: allRunsData } = await supabase
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
    .eq('project.user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  const allRuns = (allRunsData || []) as Array<{
    id: string;
    status: string;
    score_overall: number | null;
    created_at: string;
  }>;

  // Calculate stats
  const totalProjects = projects.length;
  const totalRuns = allRuns.length;
  
  const completedRunsWithScore = allRuns.filter(r => r && r.score_overall !== null);
  const avgScore = completedRunsWithScore.length > 0
    ? Math.round(completedRunsWithScore.reduce((sum, r) => sum + (r.score_overall || 0), 0) / completedRunsWithScore.length)
    : null;
  
  const successRate = totalRuns > 0
    ? Math.round((completedRunsWithScore.length / totalRuns) * 100)
    : 100;

  // Prepare chart data (last 10 runs)
  const chartData = allRuns
    .filter(r => r && r.score_overall !== null)
    .slice(-10)
    .map(run => ({
      date: new Date(run.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      score: run.score_overall || 0,
    }));

  // Get recent runs for activity feed
  const { data: recentRunsData } = await supabase
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

  const recentRuns = (recentRunsData || []) as Run[];

  const hasProjects = projects.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-1">
            Bienvenue ! Gérez vos projets et analysez votre visibilité IA.
          </p>
        </div>
        <Link 
          href="/projects/new" 
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-blue-500/25"
        >
          <Plus className="w-4 h-4" />
          Nouveau projet
        </Link>
      </div>

      {/* Empty state */}
      {!hasProjects && (
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/50 to-transparent p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">
            Créez votre premier projet
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Un projet représente une marque ou entreprise que vous souhaitez analyser. 
            Commencez par créer votre premier projet pour lancer une analyse.
          </p>
          <Link 
            href="/projects/new" 
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white font-medium rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-blue-500/25"
          >
            <Plus className="w-5 h-5" />
            Créer un projet
          </Link>
        </div>
      )}

      {/* Content with projects */}
      {hasProjects && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={<FolderOpen className="w-5 h-5" />}
              label="Projets"
              value={totalProjects.toString()}
              gradient="from-blue-500 to-blue-600"
            />
            <StatCard 
              icon={<Zap className="w-5 h-5" />}
              label="Analyses"
              value={totalRuns.toString()}
              gradient="from-violet-500 to-violet-600"
            />
            <StatCard 
              icon={<TrendingUp className="w-5 h-5" />}
              label="Score moyen"
              value={avgScore !== null ? `${avgScore}%` : '—'}
              gradient="from-cyan-500 to-cyan-600"
            />
            <StatCard 
              icon={<Target className="w-5 h-5" />}
              label="Taux de succès"
              value={`${successRate}%`}
              gradient="from-emerald-500 to-emerald-600"
            />
          </div>

          {/* Charts and Activity Row */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Score Evolution Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-white">Évolution du score</h2>
                <span className="text-xs text-zinc-500">10 dernières analyses</span>
              </div>
              {chartData.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-end gap-2 h-40">
                    {chartData.map((point, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <span className="text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {point.score}%
                        </span>
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 via-cyan-500 to-violet-500 rounded-t transition-all hover:opacity-80"
                          style={{ height: `${Math.max(5, point.score)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {chartData.map((point, i) => (
                      <div key={i} className="flex-1 text-center text-xs text-zinc-500">
                        {point.date}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">
                  Lancez une analyse pour voir l'évolution
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="font-semibold text-white">Activité récente</h2>
              </div>
              <div className="p-4 space-y-3">
                {recentRuns.length > 0 ? (
                  recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      href={`/projects/${run.project?.id || ''}/runs/${run.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        run.status === 'completed' 
                          ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20' 
                          : 'bg-zinc-800 border border-zinc-700'
                      }`}>
                        <TrendingUp className={`w-5 h-5 ${run.status === 'completed' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
                          {run.project?.name || 'Projet'}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(run.created_at)}
                        </p>
                      </div>
                      {run.score_overall !== null && (
                        <span className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                          {run.score_overall}%
                        </span>
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    Aucune activité récente
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Projects Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Mes projets</h2>
              <Link 
                href="/projects" 
                className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                Voir tout
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.slice(0, 6).map((project) => {
                // Protection null complète
                const allProjectRuns = project.runs || [];
                const completedRuns = allProjectRuns.filter((r) => r && r.status === 'completed');
                const lastRun = completedRuns.length > 0 ? completedRuns[0] : null;
                const previousRun = completedRuns.length > 1 ? completedRuns[1] : null;
                
                // Calcul sécurisé de scoreDiff
                const lastScore = lastRun?.score_overall;
                const prevScore = previousRun?.score_overall;
                const scoreDiff = (lastScore != null && prevScore != null)
                  ? lastScore - prevScore
                  : null;

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-white/[0.12] transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-xl flex items-center justify-center group-hover:border-cyan-500/30 transition-colors">
                        <span className="text-white font-semibold text-lg">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <h3 className="font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      {project.industry || 'Secteur non défini'}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                      <span className="text-xs text-zinc-500">
                        {allProjectRuns.length} analyse{allProjectRuns.length !== 1 ? 's' : ''}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {scoreDiff !== null && scoreDiff !== 0 && (
                          <span className={`text-xs ${scoreDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                          </span>
                        )}
                        {lastRun && lastRun.score_overall !== null ? (
                          <span className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
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

function StatCard({ 
  icon, 
  label, 
  value, 
  gradient 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  gradient: string;
}) {
  return (
    <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/30">
      <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
        <div className="text-white">{icon}</div>
      </div>
      <p className="text-3xl font-semibold text-white mb-1">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  );
}