'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { InfoTip } from './info-tip';

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
  positive: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-300', icon: TrendingUp },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-300', icon: TrendingDown },
  opportunity: { bg: 'quorum-surface-strong', border: 'quorum-border-strong', text: 'quorum-text-primary', icon: Activity },
  neutral: { bg: 'quorum-surface', border: 'quorum-border-default', text: 'quorum-text-muted', icon: Minus },
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
    ? 'from-white via-[#f3efe6] to-[#d7d1c6]'
    : qualityScore >= 35
      ? 'from-[#f5f0e5] via-[#d7cfbf] to-[#b8b0a1]'
      : 'from-[#e7dfd2] via-[#b3aa9b] to-[#8b8173]';

  return (
    <div className="quorum-panel-strong relative overflow-hidden p-8">
      {/* Subtle glow behind score */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full quorum-surface-strong blur-[90px]" />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Score + insight */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.24em] quorum-text-subtle">
              Score de visibilité sources
              <InfoTip text="Score composite calculé à partir du nombre de citations, de leur fraîcheur, et de la diversité des sources qui citent votre marque dans les réponses IA." />
            </p>
            {isRunning && (
              <span className="flex items-center gap-1.5 rounded-full border quorum-border-strong quorum-surface-strong px-2 py-0.5 text-[10px] font-medium quorum-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Analyse en cours
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-4">
            <span className={`bg-gradient-to-r ${scoreGradient} bg-clip-text text-6xl font-bold tracking-[-0.06em] text-transparent tabular-nums`}>
              {qualityScore}
            </span>
            <span className="text-2xl font-light quorum-text-subtle">/100</span>
          </div>

          {/* Dynamic insight badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${tone.bg} border ${tone.border}`}>
            <ToneIcon className={`w-3.5 h-3.5 ${tone.text}`} />
            <span className={`text-sm font-medium ${tone.text}`}>{insight.message}</span>
          </div>

          <p className="max-w-md text-xs leading-relaxed quorum-text-muted">
            Calculé à partir de la fréquence, du type et de la fraîcheur des sources citant votre marque dans les réponses IA.
          </p>
        </div>

        {/* Right: Mini stats */}
        <div className="flex gap-8">
          <div className="text-center">
            <p className="mb-1 inline-flex items-center gap-1 text-xs quorum-text-subtle">
              Citations
              <InfoTip text="Nombre de fois où une URL de votre marché a été explicitement citée dans une réponse IA sur la période sélectionnée." />
            </p>
            <p className="text-2xl font-semibold quorum-text-primary tabular-nums">{totalCitations}</p>
          </div>
          <div className="text-center">
            <p className="mb-1 inline-flex items-center gap-1 text-xs quorum-text-subtle">
              Part marque
              <InfoTip text="Pourcentage de citations qui pointent vers vos propres domaines (owned) parmi toutes les citations détectées." />
            </p>
            <p className="text-2xl font-semibold text-emerald-300 tabular-nums">{ownedShare}%</p>
          </div>
          <div className="text-center">
            <p className="mb-1 inline-flex items-center gap-1 text-xs quorum-text-subtle">
              Part concurrents
              <InfoTip text="Pourcentage de citations qui pointent vers des domaines classifiés comme concurrents." />
            </p>
            <p className="text-2xl font-semibold text-red-300 tabular-nums">{competitorShare}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
