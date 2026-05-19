'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Sparkles } from 'lucide-react';

function getApiErrorMessage(payload: unknown, responseText: string) {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const apiError = typeof data.error === 'string' ? data.error.trim() : '';
  if (apiError) return apiError;

  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (message) return message;

  const stage = typeof data.stage === 'string' ? data.stage.trim() : '';
  if (stage) return `Action impossible à l’étape ${stage}.`;

  const trimmed = responseText.trim();
  if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }

  return 'Action impossible pour le moment.';
}

export function ProductVisibilityPromptsActions() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const buildSuccessMessage = (path: string, payload: unknown, fallback: string) => {
    const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }

    if (path.includes('generate-prompts')) {
      const counts = data.counts && typeof data.counts === 'object' ? data.counts as Record<string, unknown> : {};
      const suggestionsList = Array.isArray(data.suggestions) ? data.suggestions : [];
      const persisted = Number(counts.persisted || 0);
      const reused = Number(counts.reused || 0);
      const suggestions = Number(counts.suggestions || suggestionsList.length || 0);
      return `${persisted} requêtes produit créées, ${reused} réutilisées, ${suggestions} disponibles pour l’analyse.`;
    }

    if (path.includes('manual-run')) {
      const summary = data.summary && typeof data.summary === 'object' ? data.summary as Record<string, unknown> : {};
      const responses = Number(summary.responses_collected || 0);
      const requests = Number(summary.requests_analyzed || 0);
      const synced = Number(summary.product_results_synced || 0);
      const syncedPart = synced > 0 ? `, ${synced} résultats produit synchronisés` : '';
      return `Analyse terminée : ${responses} réponses IA collectées sur ${requests} exécutions${syncedPart}.`;
    }

    return fallback;
  };

  const run = (path: string, successMessage: string) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persist: true }),
        });

        const responseText = await response.text();
        let payload: unknown = null;
        try {
          payload = responseText ? JSON.parse(responseText) : null;
        } catch {
          payload = null;
        }
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, responseText));
        }

        setMessage(buildSuccessMessage(path, payload, successMessage));
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Action impossible pour le moment.');
      }
    });
  };

  return (
    <div className="quorum-panel p-5">
      <p className="quorum-kicker">Actions</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="quorum-btn-secondary inline-flex items-center gap-2"
          disabled={isPending}
          onClick={() => run('/api/product-visibility/generate-prompts', 'Requêtes IA générées et ajoutées au suivi.')}
        >
          <Sparkles className="h-4 w-4" />
          Générer des requêtes IA
        </button>
        <button
          type="button"
          className="quorum-btn-secondary inline-flex items-center gap-2"
          disabled={isPending}
          onClick={() => run('/api/product-visibility/manual-run', 'Analyse terminée. Les résultats sont disponibles après actualisation.')}
        >
          <Play className="h-4 w-4" />
          Lancer l’analyse maintenant
        </button>
      </div>
      {message && <p className="mt-3 text-sm quorum-text-muted">{message}</p>}
    </div>
  );
}
