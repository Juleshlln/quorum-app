import { PromptBadge } from '@/components/analysis/prompt-badge';
import type { PromptSelection, CategoryKey } from '@/components/runs/start-run-button';

export function SelectedPromptsSummary({
  selected,
  category,
  mode,
  runCount,
  projectName,
}: {
  selected: PromptSelection[];
  category: CategoryKey;
  mode: 'trend' | 'simulation';
  runCount: number;
  projectName: string;
}) {
  const explanation =
    mode === 'trend'
      ? `Nous allons exécuter ${runCount} simulations indépendantes par prompt et mesurer la fréquence de mention de la marque, le sentiment quand elle est mentionnée, et la position si applicable.`
      : "Nous allons générer une réponse plausible à ce prompt. Cette réponse n’est pas une garantie et ne produit pas de scores probabilistes.";

  return (
    <div className="quorum-panel-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium quorum-text-primary">Récapitulatif</p>
        <PromptBadge category={category} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs quorum-text-muted">
        <span className="rounded-full border quorum-border-default px-2 py-1">
          Projet: {projectName}
        </span>
        <span className="rounded-full border quorum-border-default px-2 py-1">
          Mode: {mode === 'trend' ? 'Tendance IA' : 'Simulation utilisateur'}
        </span>
        <span className="rounded-full border quorum-border-default px-2 py-1">
          Runs: {mode === 'trend' ? runCount : 1}
        </span>
        <span className="rounded-full border quorum-border-default px-2 py-1">
          Prompts: {selected.length}
        </span>
      </div>
      <p className="text-sm quorum-text-muted">{explanation}</p>
      {selected.length === 0 ? (
        <p className="text-sm quorum-text-subtle">Aucun prompt sélectionné.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {selected.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border quorum-border-default quorum-surface-strong p-3">
              <span className="quorum-text-primary">{p.text}</span>
              <div className="flex items-center gap-2">
                <PromptBadge category={p.primaryObjective || p.category} />
                {(p.secondaryObjectives || []).map((obj) => (
                  <PromptBadge key={`${p.id}_${obj}`} category={obj} variant="outline" />
                ))}
                <span className="text-xs quorum-text-subtle">{p.type === 'custom' ? 'Perso' : 'Suggéré'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
