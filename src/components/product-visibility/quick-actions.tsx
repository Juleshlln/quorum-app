'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Play, Sparkles } from 'lucide-react';

type ActionKind = 'prompts' | 'run';

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

export function ProductVisibilityQuickActions({
  showGeneratePrompts = true,
  showRun = true,
}: {
  showGeneratePrompts?: boolean;
  showRun?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionKind | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(kind: ActionKind) {
    setMessage(null);
    setError(null);
    setPendingAction(kind);

    startTransition(async () => {
      try {
        const path = kind === 'prompts'
          ? '/api/product-visibility/generate-prompts'
          : '/api/product-visibility/manual-run';
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persist: true }),
        });

        const responseText = await response.text();
        let payload: any = null;
        try {
          payload = responseText ? JSON.parse(responseText) : null;
        } catch {
          payload = null;
        }
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, responseText));
        }

        if (kind === 'prompts') {
          const persisted = Number(payload?.counts?.persisted || 0);
          const reused = Number(payload?.counts?.reused || 0);
          const suggestions = Number(payload?.counts?.suggestions || payload?.suggestions?.length || 0);
          setMessage(`${persisted} requêtes produit créées, ${reused} réutilisées, ${suggestions} disponibles pour l’analyse.`);
        } else {
          const responses = Number(payload?.summary?.responses_collected || 0);
          const requests = Number(payload?.summary?.requests_analyzed || 0);
          const synced = Number(payload?.summary?.product_results_synced || 0);
          const syncedPart = synced > 0 ? `, ${synced} résultats produit synchronisés` : '';
          setMessage(`Analyse terminée : ${responses} réponses IA collectées sur ${requests} exécutions${syncedPart}.`);
        }
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Action impossible pour le moment.');
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showGeneratePrompts ? (
        <button
          type="button"
          className="quorum-btn-secondary inline-flex items-center gap-2 text-sm"
          disabled={isPending}
          onClick={() => runAction('prompts')}
        >
          <Sparkles className="h-4 w-4" />
          {pendingAction === 'prompts' ? 'Génération...' : 'Générer des requêtes IA'}
        </button>
      ) : null}
      {showRun ? (
        <button
          type="button"
          className="quorum-btn-primary inline-flex items-center gap-2 text-sm"
          disabled={isPending}
          onClick={() => runAction('run')}
        >
          <Play className="h-4 w-4" />
          {pendingAction === 'run' ? 'Analyse en cours...' : 'Lancer l’analyse maintenant'}
        </button>
      ) : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
