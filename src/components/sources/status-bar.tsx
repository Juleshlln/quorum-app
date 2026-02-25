'use client';

import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';

type RunStatus = {
  latestRun: {
    id: string;
    status: string;
    run_date: string;
    started_at: string | null;
    finished_at: string | null;
    error_message?: string | null;
  } | null;
};

type StatusBarProps = {
  runInfo: RunStatus;
  isLoading: boolean;
  onManualRun: () => void;
  isManualRunning: boolean;
  error?: string | null;
  cronStatus?: {
    next_run_at_utc: string;
    did_run_today: boolean;
    last_daily_run_finished_at: string | null;
    last_daily_run_status: string | null;
  } | null;
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

export function StatusBar({ runInfo, isLoading, onManualRun, isManualRunning, error, cronStatus }: StatusBarProps) {
  const status = runInfo.latestRun?.status;
  const config = status ? statusConfig[status] ?? statusConfig.pending : null;
  const StatusIcon = config?.icon ?? Clock;
  const isRunning = status === 'running' || isManualRunning;

  const latestDate =
    runInfo.latestRun?.finished_at ||
    runInfo.latestRun?.started_at ||
    runInfo.latestRun?.run_date ||
    null;

  const nextRunDate = cronStatus?.next_run_at_utc ? new Date(cronStatus.next_run_at_utc) : null;
  const nextRunLabel = nextRunDate
    ? nextRunDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
    : null;
  const todayRunTimeLabel = cronStatus?.last_daily_run_finished_at
    ? new Date(cronStatus.last_daily_run_finished_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
    : null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/30 px-4 py-2.5">
      <div className="flex items-center gap-4 text-xs">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`w-3.5 h-3.5 ${config?.color ?? 'text-zinc-500'} ${
              status === 'running' ? 'animate-spin' : ''
            }`}
          />
          <span className="text-zinc-400">{isLoading ? 'Chargement…' : config?.label ?? 'Inconnu'}</span>
        </div>

        {/* Latest successful run date */}
        {latestDate && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">Dernière collecte : {formatDate(latestDate)}</span>
          </>
        )}

        {/* Error message */}
        {runInfo.latestRun?.error_message && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-red-400/80">{runInfo.latestRun.error_message}</span>
          </>
        )}

        {error && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-red-400/80">{error}</span>
          </>
        )}

        {nextRunLabel && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">Prochain run quotidien : {nextRunLabel}</span>
          </>
        )}

        {cronStatus && (
          <>
            <span className="text-zinc-600">•</span>
            <span className={cronStatus.did_run_today ? 'text-emerald-400/90' : 'text-amber-300/90'}>
              {cronStatus.did_run_today
                ? `✅ Run quotidien effectué aujourd’hui${todayRunTimeLabel ? ` à ${todayRunTimeLabel}` : ''}`
                : '⏳ Run quotidien pas encore effectué aujourd’hui'}
            </span>
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
