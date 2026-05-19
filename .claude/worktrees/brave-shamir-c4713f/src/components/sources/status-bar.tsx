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
  success: { icon: CheckCircle2, color: 'text-emerald-300', label: 'Succès' },
  completed: { icon: CheckCircle2, color: 'text-emerald-300', label: 'Succès' },
  partial: { icon: AlertCircle, color: 'text-amber-300', label: 'Partiel' },
  running: { icon: Loader2, color: 'quorum-text-primary', label: 'En cours' },
  pending: { icon: Clock, color: 'quorum-text-muted', label: 'En attente' },
  failed: { icon: XCircle, color: 'text-red-300', label: 'Échec' },
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
    <div className="quorum-panel flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-4 text-xs">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`w-3.5 h-3.5 ${config?.color ?? 'quorum-text-subtle'} ${
              status === 'running' ? 'animate-spin' : ''
            }`}
          />
          <span className="quorum-text-muted">{isLoading ? 'Chargement…' : config?.label ?? 'Inconnu'}</span>
        </div>

        {/* Latest successful run date */}
        {latestDate && (
          <>
            <span className="quorum-text-subtle">•</span>
            <span className="quorum-text-muted">Dernière collecte : {formatDate(latestDate)}</span>
          </>
        )}

        {/* Error message */}
        {runInfo.latestRun?.error_message && (
          <>
            <span className="quorum-text-subtle">•</span>
            <span className="text-red-300/80">{runInfo.latestRun.error_message}</span>
          </>
        )}

        {error && (
          <>
            <span className="quorum-text-subtle">•</span>
            <span className="text-red-300/80">{error}</span>
          </>
        )}

        {nextRunLabel && (
          <>
            <span className="quorum-text-subtle">•</span>
            <span className="quorum-text-muted">Prochain run quotidien : {nextRunLabel}</span>
          </>
        )}

        {cronStatus && (
          <>
            <span className="quorum-text-subtle">•</span>
            <span className={cronStatus.did_run_today ? 'text-emerald-300/90' : 'text-amber-300/90'}>
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
        className="quorum-btn-secondary px-3 py-1.5 text-xs"
      >
        {isRunning ? 'Analyse en cours…' : 'Relancer'}
      </button>
    </div>
  );
}
