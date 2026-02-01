import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, FolderOpen, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Projets | Quorum',
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      runs (
        id,
        status,
        score_overall,
        created_at
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Projets</h1>
          <p className="text-zinc-400 mt-1">
            Gérez vos projets et suivez leur visibilité IA
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

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const completedRuns = project.runs?.filter((r: any) => r.status === 'completed') || [];
            const lastRun = completedRuns[0];
            const previousRun = completedRuns[1];
            
            const scoreDiff = lastRun?.score_overall !== null && previousRun?.score_overall !== null
              ? lastRun.score_overall - previousRun.score_overall
              : null;

            const TrendIcon = scoreDiff && scoreDiff > 0 ? TrendingUp : scoreDiff && scoreDiff < 0 ? TrendingDown : Minus;
            const trendColor = scoreDiff && scoreDiff > 0 ? 'text-emerald-400' : scoreDiff && scoreDiff < 0 ? 'text-red-400' : 'text-zinc-500';

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group relative p-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-white/[0.12] transition-all duration-300"
              >
                {/* Gradient glow on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-2xl flex items-center justify-center group-hover:border-cyan-500/30 transition-colors">
                      <span className="text-white font-bold text-xl">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-2">
                    {project.industry || 'Secteur non défini'}
                  </p>
                  {project.website && (
                    <p className="text-xs text-zinc-600 truncate mb-4">
                      {project.website.replace(/^https?:\/\//, '')}
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-white">{project.runs?.length || 0}</p>
                        <p className="text-xs text-zinc-500">Analyses</p>
                      </div>
                      {lastRun && (
                        <div className="text-center">
                          <p className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            {lastRun.score_overall ?? '—'}%
                          </p>
                          <p className="text-xs text-zinc-500">Score</p>
                        </div>
                      )}
                    </div>
                    
                    {scoreDiff !== null && (
                      <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                        <TrendIcon className="w-4 h-4" />
                        <span>{scoreDiff > 0 ? '+' : ''}{scoreDiff}</span>
                      </div>
                    )}
                  </div>

                  {/* Last update */}
                  {lastRun && (
                    <p className="text-xs text-zinc-600 mt-3">
                      Dernière analyse: {formatDate(lastRun.created_at)}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Add new project card */}
          <Link
            href="/projects/new"
            className="group p-6 rounded-2xl border border-dashed border-white/[0.1] hover:border-cyan-500/30 bg-transparent hover:bg-zinc-900/30 transition-all duration-300 flex flex-col items-center justify-center min-h-[280px]"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-violet-500/10 border border-white/[0.08] flex items-center justify-center mb-4 group-hover:border-cyan-500/30 transition-colors">
              <Plus className="w-7 h-7 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
            </div>
            <p className="text-sm font-medium text-zinc-500 group-hover:text-white transition-colors">
              Ajouter un projet
            </p>
          </Link>
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/50 to-transparent p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">
            Aucun projet
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Créez votre premier projet pour commencer à analyser votre visibilité dans les réponses IA.
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
    </div>
  );
}
