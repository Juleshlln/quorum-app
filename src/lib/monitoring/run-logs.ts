export async function logRun({
  supabase,
  runId,
  projectId,
  level = 'info',
  step,
  message,
  meta,
}: {
  supabase: any;
  runId: string | null | undefined;
  projectId: string;
  level?: 'info' | 'warn' | 'error';
  step: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  if (!runId) return;
  try {
    await supabase.from('run_logs').insert({
      run_id: runId,
      project_id: projectId,
      level,
      step,
      message,
      meta_json: meta || {},
    });
  } catch {
    // Best-effort logging only.
  }
}
