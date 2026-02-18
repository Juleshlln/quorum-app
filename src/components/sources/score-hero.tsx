'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

type ScoreHeroProps = {
  qualityScore: number;
  ownedShare: number;
  competitorShare: number;
  totalCitations: number;
  isRunning?: boolean;
};

function getInsight(owned: number, competitor: number, quality: number): {
  message: string;
  tone: 'positive' | 'warning' | 'neutral' | 'opportunity';
} {
  if (owned >= 30 && quality >= 60) {
    return { message: 'Votre visibilité IA est solide. Continuez à renforcer vos positions.', tone: 'positive' };
  }
  if (owned >= 15 && owned < 30 && quality >= 40) {
    return { message: 'Croissance en cours. Votre marque gagne en influence dans les réponses IA.', tone: 'positive' };
  }
  if (competitor > owned * 2) {
    return { message: 'Vos concurrents dominent les sources IA. Opportunité stratégique majeure.', tone: 'opportunity' };
  }
  if (owned < 10) {
    return { message: 'Visibilité faible. Vos contenus sont peu référencés par les modèles IA.', tone: 'warning' };
  }
  return { message: 'Visibilité stable. Identifiez les leviers pour accélérer.', tone: 'neutral' };
}

const toneColors: Record<'positive' | 'warning' | 'opportunity' | 'neutral', { bg: string; border: string; text: string; icon: typeof TrendingUp }> = {
  positive: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: TrendingUp },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: TrendingDown },
  opportunity: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', icon: Activity },
  neutral: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', text: 'text-zinc-400', icon: Minus },
};

export function ScoreHero({ qualityScore, ownedShare, competitorShare, totalCitations, isRunning }: ScoreHeroProps) {
  const insight: { message: string; tone: 'positive' | 'warning' | 'neutral' | 'opportunity' } = useMemo(
    () => getInsight(ownedShare, competitorShare, qualityScore),
    [ownedShare, competitorShare, qualityScore]
  );

  const tone = toneColors[insight.tone];
  const ToneIcon = tone.icon;

  // Score color based on value
  const scoreGradient = qualityScore >= 60
    ? 'from-emerald-400 via-cyan-400 to-blue-400'
    : qualityScore >= 35
      ? 'from-amber-400 via-orange-400 to-yellow-400'
      : 'from-red-400 via-rose-400 to-pink-400';

  return (
    <div className="relative rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-8 overflow-hidden">
      {/* Subtle glow behind score */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-violet-500/[0.04] blur-[80px] pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Score + insight */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Score de visibilité sources</p>
            {isRunning && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Analyse en cours
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-4">
            <span className={`text-6xl font-bold bg-gradient-to-r ${scoreGradient} bg-clip-text text-transparent tabular-nums tracking-tight`}>
              {qualityScore}
            </span>
            <span className="text-2xl text-zinc-500 font-light">/100</span>
          </div>

          {/* Dynamic insight badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${tone.bg} border ${tone.border}`}>
            <ToneIcon className={`w-3.5 h-3.5 ${tone.text}`} />
            <span className={`text-sm font-medium ${tone.text}`}>{insight.message}</span>
          </div>

          <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
            Calculé à partir de la fréquence, du type et de la fraîcheur des sources citant votre marque dans les réponses IA.
          </p>
        </div>

        {/* Right: Mini stats */}
        <div className="flex gap-8">
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Citations</p>
            <p className="text-2xl font-semibold text-white tabular-nums">{totalCitations}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Part marque</p>
            <p className="text-2xl font-semibold text-emerald-400 tabular-nums">{ownedShare}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 mb-1">Part concurrents</p>
            <p className="text-2xl font-semibold text-red-400 tabular-nums">{competitorShare}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
