'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2, X } from 'lucide-react';
import { AnalysisGoalSelector } from '@/components/analysis/analysis-goal-selector';
import { AnalysisModeSelector } from '@/components/analysis/analysis-mode-selector';
import { PromptSuggestionsList } from '@/components/analysis/prompt-suggestions-list';
import { CustomPromptInput } from '@/components/analysis/custom-prompt-input';
import { SelectedPromptsSummary } from '@/components/analysis/selected-prompts-summary';
import { getRunsForPlan } from '@/lib/plans';

export type AnalysisObjective = 'visibility' | 'position' | 'sentiment';
export type CategoryKey = AnalysisObjective;
export type AnalysisMode = 'trend' | 'simulation';
export type PromptSelection = {
  id: string;
  text: string;
  category: AnalysisObjective;
  type: 'suggested' | 'custom';
  templateId?: string;
  primaryObjective?: AnalysisObjective;
  secondaryObjectives?: AnalysisObjective[];
};
const MAX_PROMPTS = 10;

interface StartRunButtonProps {
  projectId: string;
  projectName: string;
  projectIndustry?: string | null;
  projectLocation?: string | null;
  projectDescription?: string | null;
}

export function StartRunButton({ projectId, projectName, projectIndustry, projectLocation, projectDescription }: StartRunButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [category, setCategory] = useState<AnalysisObjective>('visibility');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('trend');
  const [runCount, setRunCount] = useState(getRunsForPlan());
  const [selectedPrompts, setSelectedPrompts] = useState<PromptSelection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStartRun = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      if (selectedPrompts.length === 0) {
        setError('Ajoute au moins un prompt');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          category,
          objective: category,
          objectives: [category],
          analysis_mode: analysisMode,
          runs_per_prompt: analysisMode === 'trend' ? runCount : 1,
          prompts: selectedPrompts.map((p) => ({
            text: p.text,
            category: p.category,
            type: p.type,
            template_id: p.templateId,
            objective_tag: p.category,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du lancement de l'analyse");
      }

      setOpen(false);
      router.push(`/projects/${projectId}/runs/${data.analysisId}`);
      router.refresh();
    } catch (err) {
      console.error('Error starting analysis:', err);
      alert(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const onTogglePrompt = (prompt: PromptSelection, checked: boolean) => {
    setSelectedPrompts((prev) => {
      if (checked) {
        if (prev.length >= MAX_PROMPTS) {
          setError(`Limite atteinte (${MAX_PROMPTS} prompts max)`);
          return prev;
        }
        return [...prev, prompt];
      }
      return prev.filter((p) => p.id !== prompt.id);
    });
  };

  const onAddCustomPrompt = (text: string, promptCategory: CategoryKey) => {
    if (selectedPrompts.length >= MAX_PROMPTS) {
      setError(`Limite atteinte (${MAX_PROMPTS} prompts max)`);
      return;
    }
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setSelectedPrompts((prev) => [
      { id, text, category: promptCategory, type: 'custom' },
      ...prev,
    ]);
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setStep(1);
          setError(null);
          setRunCount(getRunsForPlan());
        }}
        disabled={loading}
        className="quorum-btn-primary"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyse en cours...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Lancer une analyse
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 quorum-backdrop p-4 overflow-y-auto">
          <div className="quorum-panel-strong mx-auto my-6 w-full max-w-3xl p-6 quorum-text-primary">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Nouvelle analyse</h3>
                <p className="mt-1 text-sm quorum-text-muted">
                  Choisis l’objectif, le mode, puis tes prompts avant de lancer.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl p-1.5 quorum-text-muted hover:quorum-surface"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
              {step === 1 && (
                <>
                  <AnalysisGoalSelector value={category} onChange={setCategory} />
                  <p className="mt-3 text-xs quorum-text-subtle">
                    Cet objectif pré-filtre les prompts suggérés et pré-sélectionne la catégorie par défaut.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  <AnalysisModeSelector
                    value={analysisMode}
                    runCount={runCount}
                    onChange={(nextMode) => {
                      setAnalysisMode(nextMode);
                      if (nextMode === 'simulation') {
                        setRunCount(1);
                      } else {
                        setRunCount(getRunsForPlan());
                      }
                    }}
                  />
                  <p className="mt-3 text-xs quorum-text-subtle">
                    Les runs sont contrôlés par ton plan. Tu ne peux pas les modifier ici.
                  </p>
                </>
              )}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-xs quorum-text-subtle">
                    <span>Prompts sélectionnés</span>
                    <span>{selectedPrompts.length}/{MAX_PROMPTS}</span>
                  </div>
                  <CustomPromptInput
                    defaultCategory={category}
                    onAdd={onAddCustomPrompt}
                    remaining={MAX_PROMPTS - selectedPrompts.length}
                  />
                  <PromptSuggestionsList
                    category={category}
                    brandName={projectName}
                    industry={projectIndustry}
                    location={projectLocation}
                    description={projectDescription}
                    selected={selectedPrompts}
                    onToggle={onTogglePrompt}
                  />
                  {selectedPrompts.length > 0 && (
                    <div className="quorum-panel-soft p-3">
                      <p className="mb-2 text-xs quorum-text-muted">Sélectionnés (aperçu)</p>
                      <ul className="space-y-1 text-sm quorum-text-primary">
                        {selectedPrompts.slice(0, 5).map((p) => (
                          <li key={p.id} className="truncate">• {p.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {step === 4 && (
                <SelectedPromptsSummary
                  selected={selectedPrompts}
                  category={category}
                  mode={analysisMode}
                  runCount={analysisMode === 'trend' ? runCount : 1}
                  projectName={projectName}
                />
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs quorum-text-subtle">Projet: {projectName}</p>
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <button
                    onClick={() => setStep((s) => (s === 2 ? 1 : s === 3 ? 2 : 3))}
                    className="quorum-btn-secondary"
                  >
                    Retour
                  </button>
                )}
                {step < 4 && (
                  <button
                    onClick={() => setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 4))}
                    className="quorum-btn-primary"
                  >
                    Continuer
                  </button>
                )}
                {step === 4 && (
                  <button
                    onClick={handleStartRun}
                    disabled={loading}
                    className="quorum-btn-primary"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Lancer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
