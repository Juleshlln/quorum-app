import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { 
  ArrowLeft, 
  Clock,
  Eye,
  Target,
  Heart,
  TrendingUp,
  CheckCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// ============================================
// UTILITY: Extract summary bullets from response
// ============================================
function extractSummaryBullets(response: string | null, maxBullets: number = 3): string[] {
  if (!response) return [];
  
  // Split on sentence endings (. ! ?)
  const sentences = response
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200); // Filter out too short or too long
  
  // Take the first N meaningful sentences
  const bullets = sentences.slice(0, maxBullets);
  
  // If no good sentences found, take first 150 chars
  if (bullets.length === 0 && response.length > 0) {
    const truncated = response.substring(0, 150).trim();
    return [truncated + (response.length > 150 ? '...' : '')];
  }
  
  return bullets;
}

// ============================================
// METADATA
// ============================================
export async function generateMetadata({ params }: { params: Promise<{ id: string; runId: string }> }) {
  return {
    title: 'Résultats de l\'analyse',
  };
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default async function RunResultsPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id: projectId, runId } = await params;
  const supabase = await createClient();

  // Get run with items and project
  const { data: run, error } = await supabase
    .from('runs')
    .select(`
      *,
      project:projects (
        id,
        name,
        website
      ),
      run_items (*)
    `)
    .eq('id', runId)
    .eq('project_id', projectId)
    .single();

  if (error || !run) {
    notFound();
  }

  const items = run.run_items || [];
  const mentionedCount = items.filter((item: any) => item.brand_mentioned).length;
  const totalCount = items.length;

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
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Résultats de l'analyse</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-zinc-400">
            <span>{run.project?.name}</span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDate(run.created_at)}
            </span>
          </div>
        </div>

        <StatusBadge status={run.status} />
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Score Global"
          value={run.score_overall}
          suffix="%"
          color="lime"
        />
        <ScoreCard
          icon={<Eye className="w-5 h-5" />}
          label="Visibilité"
          value={run.score_visibility}
          suffix="%"
          color="blue"
        />
        <ScoreCard
          icon={<Target className="w-5 h-5" />}
          label="Position"
          value={run.score_accuracy}
          suffix="%"
          color="purple"
        />
        <ScoreCard
          icon={<Heart className="w-5 h-5" />}
          label="Sentiment"
          value={run.score_sentiment}
          suffix="%"
          color="pink"
        />
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-6">
        <h2 className="text-sm font-medium text-white uppercase tracking-wider mb-4">
          Résumé
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-zinc-400 text-sm">Prompts analysés</p>
            <p className="text-2xl font-semibold text-white">{totalCount}</p>
          </div>
          <div>
            <p className="text-zinc-400 text-sm">Mentions de la marque</p>
            <p className="text-2xl font-semibold text-white">
              {mentionedCount} <span className="text-zinc-500 text-lg">/ {totalCount}</span>
            </p>
          </div>
          <div>
            <p className="text-zinc-400 text-sm">Taux de mention</p>
            <p className="text-2xl font-semibold text-lime-400">
              {totalCount > 0 ? Math.round((mentionedCount / totalCount) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Results */}
      <div>
        <h2 className="text-sm font-medium text-white uppercase tracking-wider mb-4">
          Détail des réponses ({items.length})
        </h2>
        
        <div className="space-y-4">
          {items.map((item: any, index: number) => (
            <ResponseCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// RESPONSE CARD COMPONENT (with summary mode)
// ============================================
function ResponseCard({ item, index }: { item: any; index: number }) {
  const summaryBullets = extractSummaryBullets(item.response);
  
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/20 overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            #{index + 1}
          </span>
          <span className="text-sm font-medium text-white">
            {item.provider === 'openai' ? 'ChatGPT' : item.provider || 'AI'}
          </span>
          <span className="text-xs text-zinc-500">
            {item.model || 'gpt-4o-mini'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {item.brand_mentioned ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-lime-400 bg-lime-400/10 px-2 py-1 rounded">
              <CheckCircle className="w-3.5 h-3.5" />
              Mentionné
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
              <XCircle className="w-3.5 h-3.5" />
              Non mentionné
            </span>
          )}
          {item.sentiment && (
            <SentimentBadge sentiment={item.sentiment} />
          )}
          {item.position && (
            <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-2 py-1 rounded">
              #{item.position}
            </span>
          )}
        </div>
      </div>

      {/* Prompt */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Prompt</p>
        <p className="text-sm text-zinc-300">{item.prompt || item.prompt_text || 'N/A'}</p>
      </div>

      {/* Summary Bullets (default view) */}
      <div className="px-4 py-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Points clés</p>
        
        {summaryBullets.length > 0 ? (
          <ul className="space-y-2">
            {summaryBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="text-lime-400 mt-1">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 italic">Aucune réponse disponible</p>
        )}

        {/* Expandable Full Response */}
        {item.response && item.response.length > 0 && (
          <details className="mt-4 group">
            <summary className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white cursor-pointer transition-colors">
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              Voir la réponse complète
            </summary>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                {item.response}
              </p>
            </div>
          </details>
        )}

        {/* Metadata */}
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-4 text-xs text-zinc-500">
          {item.response_time_ms && (
            <span>Temps: <strong className="text-zinc-300">{item.response_time_ms}ms</strong></span>
          )}
          {item.competitors_mentioned && item.competitors_mentioned.length > 0 && (
            <span>
              Concurrents mentionnés: {' '}
              <strong className="text-zinc-300">
                {item.competitors_mentioned.join(', ')}
              </strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCORE CARD COMPONENT
// ============================================
function ScoreCard({ 
  icon, 
  label, 
  value, 
  suffix = '',
  color
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number | null;
  suffix?: string;
  color: 'lime' | 'blue' | 'purple' | 'pink';
}) {
  const colorClasses = {
    lime: 'text-lime-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
  };

  return (
    <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/20">
      <div className="flex items-center gap-2 text-zinc-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-3xl font-semibold ${value !== null ? colorClasses[color] : 'text-zinc-500'}`}>
        {value !== null ? `${value}${suffix}` : '—'}
      </span>
    </div>
  );
}

// ============================================
// STATUS BADGE COMPONENT
// ============================================
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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${styles[status as keyof typeof styles] || styles.pending}`}>
      {status === 'completed' && <CheckCircle className="w-4 h-4" />}
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

// ============================================
// SENTIMENT BADGE COMPONENT
// ============================================
function SentimentBadge({ sentiment }: { sentiment: string }) {
  const styles = {
    positive: 'text-lime-400 bg-lime-400/10',
    neutral: 'text-zinc-400 bg-zinc-800',
    negative: 'text-red-400 bg-red-400/10',
  };

  const icons = {
    positive: '😊',
    neutral: '😐',
    negative: '😟',
  };

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${styles[sentiment as keyof typeof styles] || styles.neutral}`}>
      {icons[sentiment as keyof typeof icons] || '😐'} {sentiment}
    </span>
  );
}
