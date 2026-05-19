'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function ProductVisibilityRecommendationsActions() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const regenerate = () => {
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/product-visibility/generate-recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persist: true }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Impossible de générer les recommandations.');
        }

        setMessage('Recommandations générées avec succès.');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Impossible de générer les recommandations.');
      }
    });
  };

  return (
    <div className="quorum-panel p-5">
      <p className="quorum-kicker">Actions</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="quorum-btn-secondary inline-flex items-center gap-2" disabled={isPending} onClick={regenerate}>
          <RefreshCw className="h-4 w-4" />
          Générer les recommandations
        </button>
      </div>
      {message && <p className="mt-3 text-sm quorum-text-muted">{message}</p>}
    </div>
  );
}
