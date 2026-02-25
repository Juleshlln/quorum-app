import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: exportRow, error: exportError } = await supabaseAdmin
    .from('report_exports')
    .select('id, project_id, status, file_path')
    .eq('id', id)
    .single();

  if (exportError || !exportRow) {
    return NextResponse.json({ error: 'Export not found' }, { status: 404 });
  }

  const { data: project, error: projectError } = await supabaseUser
    .from('projects')
    .select('id')
    .eq('id', exportRow.project_id)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (exportRow.status !== 'done' || !exportRow.file_path) {
    return NextResponse.json({ error: 'Export is not ready' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from('reports')
    .createSignedUrl(exportRow.file_path, 60 * 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: 3600 });
}
