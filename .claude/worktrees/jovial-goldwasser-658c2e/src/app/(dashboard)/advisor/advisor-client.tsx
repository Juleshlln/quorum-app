'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, Zap, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { AdvisorOutput } from '@/lib/ai/quorum-advisor';

type Recommendation = {
  id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  output: AdvisorOutput;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
};

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const EFFORT_LABELS: Record<string, string> = {
  high: 'Effort élevé',
  medium: 'Effort moyen',
  low: 'Quick win',
};

export function AdvisorClient({
  projectName,
  initialRecommendation,
}: {
  projectName: string;
  initialRecommendation: Recommendation | null;
}) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    initialRecommendation,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAllowedAt, setNextAllowedAt] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setNextAllowedAt(null);

    try {
      const res = await fetch('/api/advisor/generate', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.');
        if (data.next_allowed_at) setNextAllowedAt(data.next_allowed_at);
        return;
      }

      setRecommendation(data.recommendation);
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const output = recommendation?.output as AdvisorOutput | null;
  const generatedAt = recommendation?.generated_at
    ? new Date(recommendation.generated_at).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="quorum-panel-strong flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="quorum-kicker">Quorum Advisor</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] quorum-text-primary">
            Recommandations IA
          </h1>
          <p className="mt-2 text-sm quorum-text-muted">
            Diagnostic et actions prioritaires pour améliorer la visibilité de{' '}
            <span className="font-medium quorum-text-primary">{projectName}</span> dans les IA
            génératives.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="quorum-btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Analyse en cours…' : 'Générer une recommandation'}
          </button>
          {generatedAt && (
            <p className="text-xs quorum-text-muted">Dernière analyse : {generatedAt}</p>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
          {nextAllowedAt && (
            <p className="mt-1 text-xs quorum-text-muted">
              Disponible à partir de{' '}
              {new Date(nextAllowedAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!output && !loading && (
        <div className="quorum-panel p-12 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 quorum-text-muted" />
          <p className="mb-2 text-base font-medium quorum-text-primary">
            Aucune recommandation générée
          </p>
          <p className="mx-auto max-w-sm text-sm quorum-text-muted">
            Cliquez sur &ldquo;Générer une recommandation&rdquo; pour obtenir un diagnostic
            complet, des opportunités identifiées et des actions prioritaires basées sur vos
            données de monitoring.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !output && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="quorum-panel animate-pulse p-6">
              <div className="mb-4 h-4 w-32 rounded-lg bg-white/10" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-4/5 rounded bg-white/5" />
                <div className="h-3 w-3/5 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {output && (
        <div className="space-y-4">
          {/* Summary */}
          <SectionCard icon={<Sparkles className="h-4 w-4 quorum-text-muted" />} title="Résumé exécutif">
            <p className="text-sm leading-relaxed quorum-text-primary">{output.summary}</p>
          </SectionCard>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Diagnosis */}
            <SectionCard icon={<TrendingUp className="h-4 w-4 quorum-text-muted" />} title="Diagnostic">
              <ul className="space-y-3">
                {output.diagnosis.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm quorum-text-primary">
                    <span
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold quorum-text-muted"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {i + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* Opportunities */}
            <SectionCard icon={<Zap className="h-4 w-4 quorum-text-muted" />} title="Opportunités">
              <ul className="space-y-3">
                {output.opportunities.map((opp, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm quorum-text-primary">
                    <span
                      className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.4)' }}
                    />
                    {opp}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {/* Actions */}
          <SectionCard icon={<Zap className="h-4 w-4 quorum-text-muted" />} title="Actions prioritaires">
            <div className="space-y-2">
              {[...output.recommended_actions]
                .sort((a, b) => a.priority - b.priority)
                .map((action, i) => (
                  <ActionCard key={i} action={action} index={i} />
                ))}
            </div>
          </SectionCard>

          {/* Content brief */}
          {output.content_brief && (
            <SectionCard icon={<FileText className="h-4 w-4 quorum-text-muted" />} title="Brief contenu">
              <h3 className="mb-5 text-base font-semibold quorum-text-primary">
                {output.content_brief.title}
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest quorum-text-muted">
                    Sections à rédiger
                  </p>
                  <ul className="space-y-2">
                    {output.content_brief.sections.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm quorum-text-primary">
                        <span className="mt-0.5 text-xs quorum-text-muted">{i + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest quorum-text-muted">
                    FAQ à inclure
                  </p>
                  <ul className="space-y-2">
                    {output.content_brief.faq.map((q, i) => (
                      <li key={i} className="text-sm quorum-text-primary">
                        <span className="quorum-text-muted">Q :</span> {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Cost metadata */}
          <div className="flex items-center justify-end gap-4 text-xs quorum-text-muted">
            <span>Modèle : {recommendation?.model}</span>
            {recommendation?.input_tokens != null && recommendation?.output_tokens != null && (
              <span>
                Tokens : {recommendation.input_tokens} + {recommendation.output_tokens}
              </span>
            )}
            {recommendation?.estimated_cost != null && (
              <span>Coût estimé : ${Number(recommendation.estimated_cost).toFixed(4)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="quorum-panel p-6">
      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {icon}
        </div>
        <h2 className="text-[11px] font-bold uppercase tracking-widest quorum-text-muted">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function ActionCard({
  action,
  index,
}: {
  action: AdvisorOutput['recommended_actions'][number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold quorum-text-muted"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium quorum-text-primary">{action.title}</span>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${IMPACT_COLORS[action.impact]}`}
          >
            Impact {action.impact}
          </span>
          <span className="hidden text-xs quorum-text-muted sm:block">
            {EFFORT_LABELS[action.effort]}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 quorum-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 quorum-text-muted" />
          )}
        </div>
      </button>
      {expanded && (
        <div
          className="border-t px-5 pb-4 pt-3 text-sm quorum-text-muted"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {action.reason}
        </div>
      )}
    </div>
  );
}
