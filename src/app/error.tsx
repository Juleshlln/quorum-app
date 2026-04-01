'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ThemeToggle } from '@/components/theme/theme-toggle';

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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="fixed right-5 top-5 z-20">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full quorum-panel-strong p-6">
        <h1 className="text-xl font-semibold quorum-text-primary">Une erreur est survenue</h1>
        <p className="mt-2 text-sm quorum-text-muted">
          Réessaie ou reviens à la page d&apos;accueil.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => reset()}
            className="quorum-btn-primary"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="quorum-btn-secondary"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
