'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';

type MonitoringRunOption = {
  id: string;
  run_date: string;
  status: string;
};

type ExportRow = {
  id: string;
  project_id: string;
  run_id: string;
  run_date: string;
  type: 'daily_audit_pdf' | 'csv_export';
  status: 'queued' | 'generating' | 'done' | 'failed';
  file_path: string | null;
  error: string | null;
  created_at: string;
};

export function DailyExportsPanel({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<MonitoringRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRunDate, setSelectedRunDate] = useState('');

  const [exportsRows, setExportsRows] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'idle' | 'csv' | 'pdf'>('idle');

  const pending = useMemo(
    () => exportsRows.some((row) => row.status === 'queued' || row.status === 'generating'),
    [exportsRows]
  );

  const loadRuns = async () => {
    try {
      const res = await fetch('/api/monitoring/daily-runs');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const successfulRuns = ((data?.runs || []) as MonitoringRunOption[]).filter(
        (run) => run.status === 'success' || run.status === 'partial'
      );
      setRuns(successfulRuns);

      if (!selectedRunId && successfulRuns.length > 0) {
        setSelectedRunId(successfulRuns[0].id);
        setSelectedRunDate(successfulRuns[0].run_date);
      }
    } catch {
      // Best effort.
    }
  };

  const loadExports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/exports?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Impossible de charger les exports.');
        return;
      }

      setExportsRows((data?.exports || []) as ExportRow[]);
    } catch {
      setError('Impossible de charger les exports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    loadExports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      loadExports();
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const createExport = async (type: 'csv_export' | 'daily_audit_pdf') => {
    if (!selectedRunDate) {
      setError('Sélectionnez une date de run.');
      return;
    }

    setAction(type === 'csv_export' ? 'csv' : 'pdf');
    setError(null);

    try {
      const res = await fetch('/api/exports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          runId: selectedRunId || null,
          runDate: selectedRunDate,
          type,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Impossible de lancer la génération.');
      }
      await loadExports();
    } catch {
      setError('Impossible de lancer la génération.');
    } finally {
      setAction('idle');
    }
  };

  const downloadExport = async (exportId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/exports/${exportId}/download`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        setError(data?.error || 'Impossible de télécharger ce fichier.');
        return;
      }

      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Impossible de télécharger ce fichier.');
    }
  };

  return (
    <section id="daily-exports" className="rounded-3xl border quorum-border-default quorum-surface-strong p-5 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold quorum-text-primary">Daily Exports</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Générez un CSV quotidien ou un PDF "Daily GEO Audit" avec méthodologie.
          </p>
        </div>
        <button
          onClick={() => {
            loadRuns();
            loadExports();
          }}
          className="inline-flex items-center gap-2 rounded-xl border quorum-border-default quorum-surface px-3 py-2 text-xs text-zinc-300 hover:quorum-surface"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <select
          value={selectedRunId}
          onChange={(e) => {
            const nextRun = runs.find((r) => r.id === e.target.value);
            setSelectedRunId(e.target.value);
            setSelectedRunDate(nextRun?.run_date || selectedRunDate);
          }}
          className="rounded-xl border quorum-border-default quorum-surface-strong px-3 py-2 text-sm text-zinc-300"
        >
          {runs.length === 0 && <option value="">Aucun run disponible</option>}
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.run_date} ({run.status})
            </option>
          ))}
        </select>

        <input
          type="date"
          value={selectedRunDate}
          onChange={(e) => setSelectedRunDate(e.target.value)}
          className="rounded-xl border quorum-border-default quorum-surface-strong px-3 py-2 text-sm text-zinc-300"
        />

        <button
          onClick={() => createExport('csv_export')}
          disabled={action !== 'idle'}
          className="inline-flex items-center justify-center gap-2 rounded-xl border quorum-border-default quorum-surface px-4 py-2 text-sm text-zinc-200 hover:quorum-surface disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          {action === 'csv' ? 'Génération...' : 'Exporter CSV'}
        </button>

        <button
          onClick={() => createExport('daily_audit_pdf')}
          disabled={action !== 'idle'}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {action === 'pdf' ? 'Génération...' : 'Générer Audit PDF'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading && exportsRows.length === 0 && (
          <p className="text-sm text-zinc-500">Chargement des exports...</p>
        )}

        {exportsRows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border quorum-border-default quorum-surface-strong px-3 py-2"
          >
            <div className="text-sm text-zinc-300">
              <span className="font-medium">
                {row.type === 'daily_audit_pdf' ? 'Daily GEO Audit PDF' : 'CSV Export'}
              </span>
              <span className="text-zinc-500"> · {row.run_date}</span>
              <span className="text-zinc-500"> · {row.status}</span>
              {row.error && <span className="text-red-300"> · {row.error}</span>}
            </div>

            <button
              onClick={() => downloadExport(row.id)}
              disabled={row.status !== 'done'}
              className="inline-flex items-center gap-2 rounded-lg border quorum-border-default quorum-surface px-3 py-1.5 text-xs text-zinc-300 hover:quorum-surface disabled:opacity-30"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        ))}

        {!loading && exportsRows.length === 0 && (
          <p className="text-sm text-zinc-500">Aucun export pour le moment.</p>
        )}
      </div>
    </section>
  );
}
