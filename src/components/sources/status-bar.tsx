'use client';

import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';

type RunStatus = {
  lastRun: {
    id: string;
    run_date: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error_message?: string | null;
  } | null;
  lastSuccess: {
    id: string;
    run_date: string;
    status: string;
    started_at: string;
    finished_at: string | null;
  } | null;
};

type StatusBarProps = {
  runInfo: RunStatus;
  isLoading: boolean;
  onManualRun: () => void;
  isManualRunning: boolean;
  error?: string | null;
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Succès' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Succès' },
  partial: { icon: AlertCircle, color: 'text-amber-400', label: 'Partiel' },
  running: { icon: Loader2, color: 'text-cyan-400', label: 'En cours' },
  pending: { icon: Clock, color: 'text-zinc-400', label: 'En attente' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Échec' },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StatusBar({ runInfo, isLoading, onManualRun, isManualRunning, error }: StatusBarProps) {
  const status = runInfo.lastRun?.status;
  const config = status ? statusConfig[status] ?? statusConfig.pending : null;
  const StatusIcon = config?.icon ?? Clock;
  const isRunning = status === 'running' || isManualRunning;

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/30 px-4 py-2.5">
      <div className="flex items-center gap-4 text-xs">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-3.5 h-3.5 ${config?.color ?? 'text-zinc-500'} ${status === 'running' ? 'animate-spin' : ''}`} />
          <span className="text-zinc-400">
            {isLoading ? 'Chargement…' : config?.label ?? 'Inconnu'}
          </span>
        </div>

        {/* Last success date */}
        {runInfo.lastSuccess && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">
              Dernière collecte : {formatDate(runInfo.lastSuccess.started_at)}
            </span>
          </>
        )}

        {/* Error message */}
        {runInfo.lastRun?.error_message && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-red-400/80">{runInfo.lastRun.error_message}</span>
          </>
        )}

        {error && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-red-400/80">{error}</span>
          </>
        )}
      </div>

      <button
        onClick={onManualRun}
        disabled={isRunning}
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isRunning ? 'Analyse en cours…' : 'Relancer'}
      </button>
    </div>
  );
}
