'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Props = {
  projectId: string;
  projectName?: string; // optionnel (utile plus tard, mais ne casse pas)
  className?: string;
  label?: string;
};

function StartRunButtonImpl({
  projectId,
  className,
  label = 'Lancer une analyse',
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        const runId = data?.run?.id || data?.id || data?.runId;
        if (!runId) throw new Error('API OK mais runId manquant dans la réponse.');

        router.push(`/projects/${projectId}/runs/${runId}`);
        router.refresh();
      } catch (e: any) {
        setError(e?.message || 'Erreur inconnue');
      }
    });
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium
                   bg-gradient-to-r from-blue-500 to-cyan-500 text-white
                   hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Analyse…' : label}
      </button>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ✅ Les 2 exports pour éviter tous les soucis d'import
export default StartRunButtonImpl;
export const StartRunButton = StartRunButtonImpl;