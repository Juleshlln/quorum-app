'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface StartRunButtonProps {
  projectId: string;
  projectName: string;
}

export function StartRunButton({ projectId, projectName }: StartRunButtonProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleStartRun = async () => {
    setIsRunning(true);
    setStatus('running');
    setMessage('Analyse en cours...');

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setStatus('success');
      setMessage(`Analyse terminée ! Score: ${data.scores.overall}%`);
      
      // Redirect to run results after a short delay
      setTimeout(() => {
        router.push(`/projects/${projectId}/runs/${data.runId}`);
        router.refresh();
      }, 1500);

    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Une erreur est survenue');
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleStartRun}
        disabled={isRunning}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
          isRunning
            ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
            : 'bg-lime-400 text-black hover:bg-lime-300'
        }`}
      >
        {status === 'running' ? (
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

      {message && (
        <div className={`flex items-center gap-2 text-sm ${
          status === 'success' ? 'text-lime-400' :
          status === 'error' ? 'text-red-400' :
          'text-zinc-400'
        }`}>
          {status === 'success' && <CheckCircle className="w-4 h-4" />}
          {status === 'error' && <AlertCircle className="w-4 h-4" />}
          {status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
          {message}
        </div>
      )}
    </div>
  );
}
