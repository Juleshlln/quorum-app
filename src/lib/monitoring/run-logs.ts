export async function logRun({
  supabase,
  runId,
  monitoringRunId,
  projectId,
  level = 'info',
  step,
  message,
  meta,
}: {
  supabase: any;
  runId: string | null | undefined;
  monitoringRunId?: string | null;
  projectId: string;
  level?: 'info' | 'warn' | 'error';
  step: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  if (!runId && !monitoringRunId) {
    console.warn(`[run-logs] Dropped log (no runId/monitoringRunId): [${level}] ${step} — ${message}`);
    return;
  }
  try {
    await supabase.from('run_logs').insert({
      run_id: runId || null,
      monitoring_run_id: monitoringRunId || null,
      project_id: projectId,
      level,
      step,
      message,
      meta_json: meta || {},
    });
  } catch (err: any) {
    console.warn(`[run-logs] Failed to persist log: [${level}] ${step} — ${message}`, err?.message || err);
  }
}
