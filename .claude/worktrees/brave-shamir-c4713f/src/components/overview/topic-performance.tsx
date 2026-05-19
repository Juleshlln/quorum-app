'use client';

import { useState } from 'react';

type PromptPerf = {
  promptId: string;
  promptText: string;
  runs: number;
  brandWins: number;
  visibility: number;
  trend: 'up' | 'stable' | 'down';
  competitors: string[];
};

type DetectedTheme = {
  name: string;
  icon: string;
  promptCount: number;
  avgVisibility: number;
};

export function TopicPerformance({
  promptPerformance,
  detectedThemes,
}: {
  promptPerformance: PromptPerf[];
  detectedThemes: DetectedTheme[];
}) {
  const [tab, setTab] = useState<'prompts' | 'themes'>('prompts');

  const trendBadge = (trend: 'up' | 'stable' | 'down') => {
    if (trend === 'up') return <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">En hausse</span>;
    if (trend === 'down') return <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">En baisse</span>;
    return <span className="rounded-full border quorum-border-default quorum-surface px-2 py-0.5 text-xs quorum-text-muted">Stable</span>;
  };

  const perfTag = (vis: number) => {
    if (vis > 50) return <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">{vis}%</span>;
    if (vis >= 20) return <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">{vis}%</span>;
    return <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">{vis}%</span>;
  };

  return (
    <div className="quorum-panel p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="quorum-kicker">Performance par sujet</p>
          <h3 className="mt-2 text-lg font-semibold quorum-text-primary">Topics actifs</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('prompts')}
            className={`quorum-chip ${tab === 'prompts' ? 'quorum-chip-active' : ''}`}
          >
            Par prompt
          </button>
          <button
            onClick={() => setTab('themes')}
            className={`quorum-chip ${tab === 'themes' ? 'quorum-chip-active' : ''}`}
          >
            Thèmes
          </button>
        </div>
      </div>

      {/* ─── Tab: Per-prompt performance ─── */}
      {tab === 'prompts' && (
        <>
          {promptPerformance.length === 0 ? (
            <div className="quorum-panel-soft p-6 text-center text-sm quorum-text-muted">
              Pas encore de métriques par prompt. Lancez un monitoring pour alimenter cette section.
            </div>
          ) : (
            <div className="space-y-2">
              {promptPerformance.slice(0, 8).map((p) => (
                <div
                  key={p.promptId}
                  className="quorum-panel-soft p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm leading-snug quorum-text-primary">
                      {p.promptText.length > 60 ? p.promptText.slice(0, 60) + '...' : p.promptText}
                    </p>
                    {trendBadge(p.trend)}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full quorum-surface-strong">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.visibility > 50
                            ? 'bg-emerald-300'
                            : p.visibility >= 20
                              ? 'bg-amber-300'
                              : 'bg-red-300'
                        }`}
                        style={{ width: `${Math.max(p.visibility, 2)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-semibold quorum-text-primary">
                      {p.visibility}%
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs quorum-text-muted">
                    <span>{p.runs} runs analysés</span>
                    <span>{p.brandWins} mentions</span>
                    {p.competitors.length > 0 && (
                      <span className="text-amber-300">
                        Concurrents: {p.competitors.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {promptPerformance.length > 8 && (
                <p className="pt-1 text-center text-xs quorum-text-subtle">
                  + {promptPerformance.length - 8} autres prompts
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Tab: Detected themes ─── */}
      {tab === 'themes' && (
        <>
          {detectedThemes.length === 0 ? (
            <div className="quorum-panel-soft p-6 text-center text-sm quorum-text-muted">
              Aucun thème détecté. Ajoutez des prompts pour détecter des thématiques.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {detectedThemes.map((theme) => (
                <div
                  key={theme.name}
                  className="quorum-panel-soft p-4 flex items-start gap-3"
                >
                  <span className="text-xl">{theme.icon}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium quorum-text-primary">{theme.name}</p>
                      {perfTag(theme.avgVisibility)}
                    </div>
                    <p className="text-xs quorum-text-muted">
                      {theme.promptCount} prompt{theme.promptCount > 1 ? 's' : ''} · Visibilité moy. {theme.avgVisibility}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
