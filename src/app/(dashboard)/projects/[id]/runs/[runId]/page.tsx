import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { 
  ArrowLeft, 
  Clock, 
  TrendingUp, 
  Eye, 
  Target, 
  Heart,
  CheckCircle,
  XCircle,
  ChevronDown,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ id: string; runId: string }> }) {
  return { title: 'Résultats de l\'analyse | Quorum' };
}

function extractSummaryBullets(response: string | null, maxBullets: number = 3): string[] {
  if (!response) return [];
  const sentences = response
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200);
  if (sentences.length === 0) {
    return [response.substring(0, 150) + (response.length > 150 ? '...' : '')];
  }
  return sentences.slice(0, maxBullets);
}

export default async function RunResultsPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const supabase = await createClient();

  const { data: run, error: runError } = await supabase
    .from('runs')
    .select(`*, project:projects (id, name, brand_name)`)
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return notFound();
  }

  // Type assertion
  const runData = run as {
    id: string;
    status: string;
    score_overall: number | null;
    score_visibility: number | null;
    score_accuracy: number | null;
    score_sentiment: number | null;
    created_at: string;
    project: { id: string; name: string; brand_name: string | null } | null;
  };

  const { data: runItems } = await supabase
    .from('run_items')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  // Type assertion for items
  const items = (runItems || []) as Array<{
    id: string;
    prompt_text: string;
    prompt?: string;
    response: string | null;
    provider?: string;
    model?: string;
    mentioned?: boolean | null;
    brand_mentioned?: boolean | null;
    response_time_ms?: number | null;
    latency_ms?: number | null;
  }>;

  const mentionedCount = items.filter(item => item.mentioned === true || item.brand_mentioned === true).length;
  const totalItems = items.length;
  const mentionRate = totalItems > 0 ? Math.round((mentionedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-8">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour au projet
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Résultats de l'analyse</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-zinc-400">
            <span>{runData.project?.name}</span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDate(runData.created_at)}
            </span>
          </div>
        </div>
        <StatusBadge status={runData.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard icon={<TrendingUp className="w-5 h-5" />} label="Score Global" value={runData.score_overall} gradient="from-blue-500 to-cyan-500" />
        <ScoreCard icon={<Eye className="w-5 h-5" />} label="Visibilité" value={runData.score_visibility} gradient="from-cyan-500 to-teal-500" />
        <ScoreCard icon={<Target className="w-5 h-5" />} label="Position" value={runData.score_accuracy} gradient="from-violet-500 to-purple-500" />
        <ScoreCard icon={<Heart className="w-5 h-5" />} label="Sentiment" value={runData.score_sentiment} gradient="from-pink-500 to-rose-500" />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Résumé</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-zinc-500 text-sm mb-1">Prompts analysés</p>
            <p className="text-3xl font-semibold text-white">{totalItems}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-sm mb-1">Mentions de la marque</p>
            <p className="text-3xl font-semibold text-white">{mentionedCount} <span className="text-lg text-zinc-500">/ {totalItems}</span></p>
          </div>
          <div>
            <p className="text-zinc-500 text-sm mb-1">Taux de mention</p>
            <p className="text-3xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{mentionRate}%</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Détail des réponses ({totalItems})</h2>
        <div className="space-y-4">
          {items.map((item, index) => {
            const bullets = extractSummaryBullets(item.response);
            const isMentioned = item.mentioned ?? item.brand_mentioned ?? null;
            return (
              <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-500">#{index + 1}</span>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-white">{item.provider || 'ChatGPT'}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{item.model || 'gpt-4o-mini'}</span>
                  </div>
                  {isMentioned !== null && (
                    <div className={`flex items-center gap-1.5 text-sm ${isMentioned ? 'text-cyan-400' : 'text-zinc-500'}`}>
                      {isMentioned ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {isMentioned ? 'Mentionné' : 'Non mentionné'}
                    </div>
                  )}
                </div>
                
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Prompt</p>
                    <p className="text-zinc-300">{item.prompt || item.prompt_text}</p>
                  </div>
                  
                  {bullets.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Points clés</p>
                      <ul className="space-y-2">
                        {bullets.map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 mt-2 flex-shrink-0" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.response && (
                    <details className="group">
                      <summary className="flex items-center gap-2 text-sm text-cyan-400 cursor-pointer hover:text-cyan-300 transition-colors">
                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                        Voir la réponse complète
                      </summary>
                      <div className="mt-3 p-4 rounded-xl bg-zinc-800/50 border border-white/[0.06] text-sm text-zinc-300 whitespace-pre-wrap">
                        {item.response}
                      </div>
                    </details>
                  )}

                  {(item.response_time_ms || item.latency_ms) && (
                    <p className="text-xs text-zinc-600">Temps: {item.response_time_ms || item.latency_ms}ms</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ icon, label, value, gradient }: { icon: React.ReactNode; label: string; value: number | null; gradient: string }) {
  return (
    <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/30">
      <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
        <div className="text-white">{icon}</div>
      </div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
        {value !== null ? `${value}%` : '—'}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-cyan-500/10 border-cyan-500/20', text: 'text-cyan-400', label: 'Terminé' },
    running: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'En cours' },
    failed: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'Échec' },
    pending: { bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400', label: 'En attente' },
  };
  const { bg, text, label } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${bg} ${text}`}>
      <CheckCircle className="w-4 h-4" />
      {label}
    </span>
  );
}
