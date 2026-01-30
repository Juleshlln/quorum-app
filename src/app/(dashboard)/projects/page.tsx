import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, Play, Calendar, ArrowUpRight, Globe } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Projets',
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
      ),
      competitors (
        id
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projets</h1>
          <p className="text-zinc-400 mt-1">
            Gérez vos marques et lancez des analyses de visibilité IA.
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

      {/* Projects grid */}
      {projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const lastRun = project.runs?.[0];
            const runCount = project.runs?.length || 0;
            const competitorCount = project.competitors?.length || 0;

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group p-6 rounded-xl border border-white/10 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-white/20 transition-all"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                    <span className="text-white font-semibold text-lg">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Name and info */}
                <h3 className="font-semibold text-white mb-1 group-hover:text-lime-400 transition-colors">
                  {project.name}
                </h3>
                
                {project.website && (
                  <p className="text-sm text-zinc-500 flex items-center gap-1.5 mb-1">
                    <Globe className="w-3.5 h-3.5" />
                    {project.website.replace(/^https?:\/\//, '')}
                  </p>
                )}
                
                <p className="text-sm text-zinc-500 mb-4">
                  {project.industry || 'Secteur non défini'}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5" />
                      {runCount} analyse{runCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {lastRun?.score_overall !== null && lastRun?.score_overall !== undefined && (
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      lastRun.score_overall >= 70 
                        ? 'bg-lime-400/10 text-lime-400' 
                        : lastRun.score_overall >= 50 
                        ? 'bg-yellow-400/10 text-yellow-400'
                        : 'bg-red-400/10 text-red-400'
                    }`}>
                      {lastRun.score_overall}%
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Plus className="w-8 h-8 text-zinc-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Aucun projet
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Créez votre premier projet pour commencer à analyser la visibilité 
            de votre marque dans les réponses des IA.
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
    </div>
  );
}
