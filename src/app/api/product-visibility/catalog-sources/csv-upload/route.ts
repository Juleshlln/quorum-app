/**
 * Upload CSV en une étape : crée la source CSV (si nécessaire) puis lance l'import.
 *
 * Form data attendu :
 * - file       : fichier CSV (UTF-8 ; max ~5 MB recommandé)
 * - source_id  : (optionnel) UUID d'une source CSV existante à réutiliser
 * - name       : (si pas de source_id) nom de la source à créer
 * - default_category_id : (optionnel) catégorie par défaut
 * - is_owned   : (optionnel, défaut true)
 * - brand_default : (optionnel) marque par défaut pour les lignes sans brand
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';
import { runCatalogSync, toPublicSource } from '@/lib/product-catalog/sync';
import { trimOrNull } from '@/lib/product-catalog/normalize';
import type { CatalogSourceConfig, CatalogSourceRow } from '@/lib/product-catalog/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { ok: false, error: 'Content-Type doit être multipart/form-data.' },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Lecture du formulaire impossible : ${err instanceof Error ? err.message : ''}` },
      { status: 400 },
    );
  }

  const fileEntry = form.get('file');
  if (!fileEntry || typeof (fileEntry as Blob).text !== 'function') {
    return NextResponse.json({ ok: false, error: 'Champ "file" manquant.' }, { status: 400 });
  }
  const file = fileEntry as Blob & { name?: string };
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 413 });
  }

  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'Lecture du fichier impossible.' }, { status: 400 });
  }
  if (!csvText.trim()) {
    return NextResponse.json({ ok: false, error: 'Fichier CSV vide.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  let sourceId = trimOrNull(String(form.get('source_id') || ''));

  if (!sourceId) {
    const name =
      trimOrNull(String(form.get('name') || '')) ||
      ((file.name as string | undefined) ? `CSV — ${file.name}` : 'Import CSV');
    const config: CatalogSourceConfig = {
      brand_default: trimOrNull(String(form.get('brand_default') || '')) || null,
      is_owned: form.get('is_owned') === 'false' ? false : true,
    };
    const defaultCategoryId = trimOrNull(String(form.get('default_category_id') || '')) || null;

    const { data, error } = await supabase
      .from('product_catalog_sources')
      .insert({
        project_id: ctx.project.id,
        kind: 'csv',
        name,
        config,
        default_category_id: defaultCategoryId,
        status: 'active',
      })
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'Création de la source CSV impossible.' },
        { status: 500 },
      );
    }
    sourceId = (data as CatalogSourceRow).id;
  } else {
    // Vérifie que la source appartient bien au projet et est de type CSV.
    const { data: existing, error: existingError } = await supabase
      .from('product_catalog_sources')
      .select('id, kind, project_id')
      .eq('id', sourceId)
      .maybeSingle();
    if (existingError || !existing) {
      return NextResponse.json({ ok: false, error: 'Source introuvable.' }, { status: 404 });
    }
    if (existing.project_id !== ctx.project.id) {
      return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
    }
    if (existing.kind !== 'csv') {
      return NextResponse.json({ ok: false, error: 'La source ciblée n’est pas de type CSV.' }, { status: 400 });
    }
  }

  try {
    const summary = await runCatalogSync({
      supabase,
      projectId: ctx.project.id,
      sourceId: sourceId!,
      csvText,
    });

    const { data: source } = await supabase
      .from('product_catalog_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    return NextResponse.json({
      ok: true,
      summary,
      source: source ? toPublicSource(source as CatalogSourceRow) : null,
    });
  } catch (err) {
    console.error('[csv-upload] failed', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Échec de l’import.' },
      { status: 500 },
    );
  }
}
