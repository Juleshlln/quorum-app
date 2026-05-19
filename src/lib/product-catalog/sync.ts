/**
 * Orchestrateur d'import de catalogue.
 *
 * - Charge la source en DB.
 * - Instancie l'adapter approprié.
 * - Upsert dans `products` + résolution catégories.
 * - Crée un enregistrement dans `product_catalog_imports` (running → success/partial/failed).
 * - Met à jour `product_catalog_sources` (last_synced_at, last_error, last_item_count, status).
 */

import type {
  CatalogImportStatus,
  CatalogSourceKind,
  CatalogSourcePublic,
  CatalogSourceRow,
  ImportError,
  ImportSummary,
  RawProduct,
} from './types';
import { upsertRawProducts } from './upsert';
import { collectSitemapProducts, summarizeSitemapConfig } from './adapters/sitemap';
import { collectCsvProducts } from './adapters/csv';
import { collectShopifyProducts, summarizeShopifyConfig } from './adapters/shopify';
import { collectWooCommerceProducts, summarizeWooConfig } from './adapters/woocommerce';
import { uniqByExternalRef } from './normalize';

type SupabaseAdmin = any;

const MAX_PERSISTED_ERRORS = 50;

export type RunSyncArgs = {
  supabase: SupabaseAdmin;
  projectId: string;
  sourceId: string;
  /** Pour la source CSV uniquement : contenu du fichier déjà décodé en UTF-8. */
  csvText?: string;
  /** Forcer le statut "owned" sur les produits importés (override config.is_owned). */
  forceOwned?: boolean;
};

export type RunSyncOutcome = ImportSummary & {
  source_kind: CatalogSourceKind;
  source_name: string;
};

export async function runCatalogSync(args: RunSyncArgs): Promise<RunSyncOutcome> {
  const startedAt = new Date();
  const errors: ImportError[] = [];

  const source = await loadSource(args.supabase, args.projectId, args.sourceId);

  // 1) Crée l'enregistrement d'import en "running"
  const { data: importRow, error: importErr } = await args.supabase
    .from('product_catalog_imports')
    .insert({
      project_id: args.projectId,
      source_id: source.id,
      started_at: startedAt.toISOString(),
      status: 'running',
    })
    .select('id')
    .single();
  if (importErr || !importRow) {
    throw new Error(
      `Impossible d'enregistrer l'import : ${importErr?.message || 'erreur inconnue'}`,
    );
  }
  const importId = importRow.id as string;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let collected: RawProduct[] = [];
  let status: CatalogImportStatus = 'success';

  try {
    const captureError = (err: ImportError) => {
      errors.push(err);
    };

    switch (source.kind) {
      case 'sitemap':
        collected = await collectSitemapProducts({
          config: source.config,
          onError: captureError,
        });
        break;
      case 'csv':
        if (!args.csvText) {
          throw new Error('Aucun fichier CSV fourni pour cet import.');
        }
        collected = collectCsvProducts({ csvText: args.csvText });
        break;
      case 'shopify':
        collected = await collectShopifyProducts({
          config: source.config,
          onError: captureError,
        });
        break;
      case 'woocommerce':
        collected = await collectWooCommerceProducts({
          config: source.config,
          onError: captureError,
        });
        break;
      default:
        throw new Error(`Type de source inconnu : ${source.kind}`);
    }

    collected = uniqByExternalRef(collected);

    // 2) Upsert
    const isOwned =
      typeof args.forceOwned === 'boolean' ? args.forceOwned : Boolean(source.config.is_owned);
    const upsertResult = await upsertRawProducts(
      {
        supabase: args.supabase,
        projectId: args.projectId,
        catalogSourceId: source.id,
        defaultCategoryId: source.default_category_id,
        defaultBrand: source.config.brand_default ?? null,
        isOwned,
      },
      collected,
    );

    inserted = upsertResult.inserted;
    updated = upsertResult.updated;
    skipped = upsertResult.skipped;
    for (const err of upsertResult.errors) errors.push(err);

    if (inserted + updated === 0 && collected.length > 0) {
      status = 'partial';
    } else if (errors.length > 0 && inserted + updated > 0) {
      status = 'partial';
    } else if (errors.length > 0 && inserted + updated === 0) {
      status = 'failed';
    } else {
      status = 'success';
    }
  } catch (err) {
    status = 'failed';
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    errors.push({ stage: 'fetch', message });
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  // 3) Met à jour l'import
  await args.supabase
    .from('product_catalog_imports')
    .update({
      finished_at: finishedAt.toISOString(),
      status,
      inserted_count: inserted,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errors.length,
      errors: errors.slice(0, MAX_PERSISTED_ERRORS),
      summary: {
        collected: collected.length,
        duration_ms: durationMs,
        kind: source.kind,
      },
    })
    .eq('id', importId);

  // 4) Met à jour la source
  await args.supabase
    .from('product_catalog_sources')
    .update({
      last_synced_at: finishedAt.toISOString(),
      last_error: status === 'failed' ? errors[errors.length - 1]?.message || 'Échec' : null,
      last_item_count: inserted + updated,
      status: status === 'failed' ? 'error' : 'active',
      updated_at: finishedAt.toISOString(),
    })
    .eq('id', source.id);

  return {
    source_id: source.id,
    source_kind: source.kind,
    source_name: source.name,
    status,
    inserted,
    updated,
    skipped,
    errors: errors.slice(0, MAX_PERSISTED_ERRORS),
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs,
  };
}

export async function loadSource(
  supabase: SupabaseAdmin,
  projectId: string,
  sourceId: string,
): Promise<CatalogSourceRow> {
  const { data, error } = await supabase
    .from('product_catalog_sources')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', sourceId)
    .single();
  if (error || !data) {
    throw new Error(`Source de catalogue introuvable (${sourceId}).`);
  }
  return data as CatalogSourceRow;
}

/** Convertit une source brute en sa vue publique (sans credentials). */
export function toPublicSource(row: CatalogSourceRow): CatalogSourcePublic {
  let summary: CatalogSourcePublic['config_summary'];
  switch (row.kind) {
    case 'sitemap':
      summary = summarizeSitemapConfig(row.config);
      break;
    case 'shopify':
      summary = summarizeShopifyConfig(row.config);
      break;
    case 'woocommerce':
      summary = summarizeWooConfig(row.config);
      break;
    case 'csv':
    default:
      summary = {
        has_credentials: false,
        brand_default: row.config.brand_default ?? null,
        is_owned: Boolean(row.config.is_owned),
      };
      break;
  }
  const { config: _omit, ...rest } = row;
  return { ...rest, config_summary: summary };
}
