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
    if (trend === 'up') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">En hausse</span>;
    if (trend === 'down') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">En baisse</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400">Stable</span>;
  };

  const perfTag = (vis: number) => {
    if (vis > 50) return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{vis}%</span>;
    if (vis >= 20) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{vis}%</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{vis}%</span>;
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">Performance par sujet</p>
          <h3 className="text-lg font-semibold text-white">Topics actifs</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('prompts')}
            className={`px-3 py-1 rounded-full border text-xs transition-colors ${tab === 'prompts' ? 'border-cyan-500/50 text-cyan-300' : 'border-white/10 text-zinc-400 hover:text-zinc-300'}`}
          >
            Par prompt
          </button>
          <button
            onClick={() => setTab('themes')}
            className={`px-3 py-1 rounded-full border text-xs transition-colors ${tab === 'themes' ? 'border-cyan-500/50 text-cyan-300' : 'border-white/10 text-zinc-400 hover:text-zinc-300'}`}
          >
            Thèmes
          </button>
        </div>
      </div>

      {/* ─── Tab: Per-prompt performance ─── */}
      {tab === 'prompts' && (
        <>
          {promptPerformance.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
              Pas encore de métriques par prompt. Lancez un monitoring pour alimenter cette section.
            </div>
          ) : (
            <div className="space-y-2">
              {promptPerformance.slice(0, 8).map((p) => (
                <div
                  key={p.promptId}
                  className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-zinc-200 leading-snug flex-1">
                      {p.promptText.length > 60 ? p.promptText.slice(0, 60) + '...' : p.promptText}
                    </p>
                    {trendBadge(p.trend)}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p.visibility > 50
                            ? 'bg-emerald-500'
                            : p.visibility >= 20
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(p.visibility, 2)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-white w-12 text-right">
                      {p.visibility}%
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>{p.runs} runs analysés</span>
                    <span>{p.brandWins} mentions</span>
                    {p.competitors.length > 0 && (
                      <span className="text-amber-400">
                        Concurrents: {p.competitors.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {promptPerformance.length > 8 && (
                <p className="text-xs text-zinc-500 text-center pt-1">
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
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
              Aucun thème détecté. Ajoutez des prompts pour détecter des thématiques.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {detectedThemes.map((theme) => (
                <div
                  key={theme.name}
                  className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 flex items-start gap-3"
                >
                  <span className="text-xl">{theme.icon}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{theme.name}</p>
                      {perfTag(theme.avgVisibility)}
                    </div>
                    <p className="text-xs text-zinc-500">
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
