import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';
import { runCatalogSync } from '@/lib/product-catalog/sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  const sourceId = await resolveId(context);

  // Pour la source CSV, on accepte un body JSON { csvText } ou multipart.
  let csvText: string | undefined;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { csvText?: string };
      if (body && typeof body.csvText === 'string' && body.csvText.length > 0) {
        csvText = body.csvText;
      }
    } catch {
      // body vide accepté pour les autres types de source
    }
  } else if (contentType.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      const file = form.get('file');
      if (file && typeof (file as Blob).text === 'function') {
        csvText = await (file as Blob).text();
      }
    } catch (err) {
      console.error('[catalog-sync] formData error', err);
    }
  }

  try {
    const supabase = createAdminClient();
    const summary = await runCatalogSync({
      supabase,
      projectId: ctx.project.id,
      sourceId,
      csvText,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('[catalog-sync] failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Échec de la synchronisation.',
      },
      { status: 500 },
    );
  }
}
