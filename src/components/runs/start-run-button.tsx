'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2 } from 'lucide-react';

interface StartRunButtonProps {
  projectId: string;
  projectName: string;
}

export function StartRunButton({ projectId, projectName }: StartRunButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStartRun = async () => {
    if (loading) return;
    
    setLoading(true);

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du lancement de l\'analyse');
      }

      router.push(`/projects/${projectId}/runs/${data.runId}`);
      router.refresh();
    } catch (error) {
      console.error('Error starting run:', error);
      alert(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleStartRun}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
