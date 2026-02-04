'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Minimal logging to avoid crashing the error boundary itself
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Réessaie ou reviens à la page d’accueil.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-xl border border-white/15 text-sm text-zinc-200 hover:bg-white/5"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}
