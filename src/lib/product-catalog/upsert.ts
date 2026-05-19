/**
 * Upsert d'un lot de produits bruts (RawProduct) dans la table `products`,
 * avec résolution automatique de la catégorie via `product_categories.name`
 * (création à la volée si inexistante).
 */

import type { RawProduct, ImportError } from './types';
import {
  clampString,
  leafCategoryFromPath,
  normalizeText,
  normalizeUrl,
  parseAvailability,
  parseNumber,
  trimOrNull,
} from './normalize';

type SupabaseAdmin = any;

const MAX_NAME_LEN = 500;
const MAX_BRAND_LEN = 200;
const MAX_DESCRIPTION_LEN = 4000;
const MAX_KEYWORDS = 20;

export type UpsertContext = {
  supabase: SupabaseAdmin;
  projectId: string;
  catalogSourceId: string;
  defaultCategoryId: string | null;
  defaultBrand?: string | null;
  isOwned: boolean;
};

export type UpsertResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
};

type CategoryCache = Map<string, string>;

async function loadCategoryCache(ctx: UpsertContext): Promise<CategoryCache> {
  const cache: CategoryCache = new Map();
  const { data, error } = await ctx.supabase
    .from('product_categories')
    .select('id,name')
    .eq('project_id', ctx.projectId);
  if (error) {
    throw new Error(`Impossible de charger les catégories : ${error.message}`);
  }
  for (const row of data || []) {
    if (row?.name) cache.set(normalizeText(row.name), row.id);
  }
  return cache;
}

async function ensureCategory(ctx: UpsertContext, cache: CategoryCache, name: string | null): Promise<string | null> {
  const trimmed = trimOrNull(name);
  if (!trimmed) return null;
  const key = normalizeText(trimmed);
  const cached = cache.get(key);
  if (cached) return cached;

  const { data, error } = await ctx.supabase
    .from('product_categories')
    .insert({
      project_id: ctx.projectId,
      name: trimmed,
      status: 'active',
      priority: 'medium',
    })
    .select('id')
    .single();

  if (error) {
    // Possibilité de race condition (unique violation) — on retente en lecture.
    const { data: existing } = await ctx.supabase
      .from('product_categories')
      .select('id')
      .eq('project_id', ctx.projectId)
      .ilike('name', trimmed)
      .maybeSingle();
    if (existing?.id) {
      cache.set(key, existing.id);
      return existing.id;
    }
    throw new Error(`Impossible de créer la catégorie "${trimmed}" : ${error.message}`);
  }

  cache.set(key, data.id);
  return data.id;
}

function sanitizeRaw(raw: RawProduct, defaultBrand?: string | null) {
  const product_name = clampString(raw.product_name, MAX_NAME_LEN);
  if (!product_name) return null;

  const external_ref = trimOrNull(raw.external_ref);
  if (!external_ref) return null;

  const brand_name = clampString(raw.brand_name ?? defaultBrand ?? null, MAX_BRAND_LEN);
  const sku = clampString(raw.sku ?? null, 200);
  const product_url = normalizeUrl(raw.product_url ?? null);
  const image_url = normalizeUrl(raw.image_url ?? null);
  const description = clampString(raw.description ?? null, MAX_DESCRIPTION_LEN);

  const attributes: Record<string, unknown> = {
    ...(raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : {}),
  };
  if (description) attributes.description = description;

  const keywords = Array.isArray(raw.target_keywords)
    ? Array.from(
        new Set(
          raw.target_keywords
            .map((k) => trimOrNull(String(k)))
            .filter((k): k is string => Boolean(k))
            .slice(0, MAX_KEYWORDS),
        ),
      )
    : [];

  const price_amount = raw.price_amount === null || raw.price_amount === undefined
    ? null
    : parseNumber(raw.price_amount);
  const price_currency = clampString(raw.price_currency ?? null, 8);
  const availability = parseAvailability(raw.availability ?? null);

  return {
    external_ref,
    product_name,
    brand_name,
    sku,
    product_url,
    image_url,
    attributes,
    keywords,
    price_amount,
    price_currency,
    availability,
    category_path: trimOrNull(raw.category_path ?? null),
    category_id_hint: trimOrNull(raw.category_id ?? null),
  };
}

/**
 * Upsert d'un lot de produits. Les produits avec un `external_ref` déjà connu
 * pour la même `catalog_source_id` sont mis à jour, sinon insérés.
 */
export async function upsertRawProducts(ctx: UpsertContext, items: RawProduct[]): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  if (items.length === 0) return result;

  const cache = await loadCategoryCache(ctx);

  // Index des produits déjà rattachés à cette source pour distinguer insert/update.
  const externalRefs = items
    .map((item) => trimOrNull(item.external_ref))
    .filter((ref): ref is string => Boolean(ref));

  const existing = new Map<string, string>();
  if (externalRefs.length > 0) {
    // Supabase limite l'opérateur "in" à 1000 valeurs ; on chunk.
    for (let i = 0; i < externalRefs.length; i += 500) {
      const chunk = externalRefs.slice(i, i + 500);
      const { data, error } = await ctx.supabase
        .from('products')
        .select('id, external_ref')
        .eq('catalog_source_id', ctx.catalogSourceId)
        .in('external_ref', chunk);
      if (error) {
        result.errors.push({ stage: 'upsert', message: `Lecture existants : ${error.message}` });
      } else {
        for (const row of data || []) {
          if (row?.external_ref) existing.set(row.external_ref, row.id);
        }
      }
    }
  }

  for (const item of items) {
    if (item._skip_reason) {
      result.skipped += 1;
      continue;
    }
    try {
      const sanitized = sanitizeRaw(item, ctx.defaultBrand);
      if (!sanitized) {
        result.skipped += 1;
        continue;
      }

      let categoryId: string | null = sanitized.category_id_hint;
      if (!categoryId) {
        const leaf = leafCategoryFromPath(sanitized.category_path);
        if (leaf) {
          categoryId = await ensureCategory(ctx, cache, leaf);
        }
      }
      if (!categoryId && ctx.defaultCategoryId) {
        categoryId = ctx.defaultCategoryId;
      }

      const payload: Record<string, unknown> = {
        project_id: ctx.projectId,
        catalog_source_id: ctx.catalogSourceId,
        external_ref: sanitized.external_ref,
        product_name: sanitized.product_name,
        brand_name: sanitized.brand_name,
        sku: sanitized.sku,
        product_url: sanitized.product_url,
        image_url: sanitized.image_url,
        attributes: sanitized.attributes,
        target_keywords: sanitized.keywords,
        price_amount: sanitized.price_amount,
        price_currency: sanitized.price_currency,
        availability: sanitized.availability,
        category_id: categoryId,
        is_owned_product: ctx.isOwned,
        status: 'active',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingId = existing.get(sanitized.external_ref);
      if (existingId) {
        const { error } = await ctx.supabase.from('products').update(payload).eq('id', existingId);
        if (error) {
          result.errors.push({
            stage: 'upsert',
            external_ref: sanitized.external_ref,
            product_name: sanitized.product_name,
            message: error.message,
          });
        } else {
          result.updated += 1;
        }
      } else {
        const { error } = await ctx.supabase.from('products').insert(payload);
        if (error) {
          // Conflit possible sur l'index unique legacy (project_id, lower(name), sku) — on tente un update fallback.
          if (String(error.code) === '23505') {
            const { data: matched } = await ctx.supabase
              .from('products')
              .select('id')
              .eq('project_id', ctx.projectId)
              .ilike('product_name', sanitized.product_name)
              .limit(1)
              .maybeSingle();
            if (matched?.id) {
              const { error: updateError } = await ctx.supabase
                .from('products')
                .update(payload)
                .eq('id', matched.id);
              if (updateError) {
                result.errors.push({
                  stage: 'upsert',
                  external_ref: sanitized.external_ref,
                  product_name: sanitized.product_name,
                  message: updateError.message,
                });
              } else {
                result.updated += 1;
              }
              continue;
            }
          }
          result.errors.push({
            stage: 'upsert',
            external_ref: sanitized.external_ref,
            product_name: sanitized.product_name,
            message: error.message,
          });
        } else {
          result.inserted += 1;
        }
      }
    } catch (err) {
      result.errors.push({
        stage: 'normalize',
        external_ref: trimOrNull(item.external_ref) || null,
        product_name: trimOrNull(item.product_name) || null,
        message: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  }

  return result;
}
