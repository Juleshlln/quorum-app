import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';
import { toPublicSource } from '@/lib/product-catalog/sync';
import type {
  CatalogSourceConfig,
  CatalogSourceKind,
  CatalogSourceRow,
} from '@/lib/product-catalog/types';
import { ensureHttps, trimOrNull } from '@/lib/product-catalog/normalize';

export const runtime = 'nodejs';

const VALID_KINDS: CatalogSourceKind[] = ['sitemap', 'csv', 'shopify', 'woocommerce'];

export async function GET() {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('product_catalog_sources')
    .select('*')
    .eq('project_id', ctx.project.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, sources: [] },
      { status: 500 },
    );
  }

  const sources = (data || []).map((row: any) => toPublicSource(row as CatalogSourceRow));
  return NextResponse.json({ ok: true, sources });
}

export async function POST(request: NextRequest) {
  const ctx = await requireActiveProjectForProductVisibility();
  if (ctx.error) return ctx.error;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const validation = validateNewSource(payload);
  if ('error' in validation) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('product_catalog_sources')
    .insert({
      project_id: ctx.project.id,
      kind: validation.kind,
      name: validation.name,
      config: validation.config,
      default_category_id: validation.defaultCategoryId,
      status: 'active',
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Création impossible.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, source: toPublicSource(data as CatalogSourceRow) });
}

type ValidNewSource = {
  kind: CatalogSourceKind;
  name: string;
  config: CatalogSourceConfig;
  defaultCategoryId: string | null;
};

function validateNewSource(payload: unknown): ValidNewSource | { error: string } {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Payload invalide.' };
  }
  const body = payload as Record<string, unknown>;

  const kind = String(body.kind || '') as CatalogSourceKind;
  if (!VALID_KINDS.includes(kind)) {
    return { error: `Type de source invalide. Valeurs autorisées : ${VALID_KINDS.join(', ')}.` };
  }

  const name = trimOrNull(String(body.name || ''));
  if (!name) return { error: 'Le nom de la source est requis.' };
  if (name.length > 200) return { error: 'Le nom ne peut pas dépasser 200 caractères.' };

  const defaultCategoryId = trimOrNull(String(body.default_category_id || '')) || null;

  const rawConfig = (body.config && typeof body.config === 'object') ? (body.config as Record<string, unknown>) : {};
  const config: CatalogSourceConfig = {
    brand_default: trimOrNull(String(rawConfig.brand_default || '')) || null,
    is_owned: Boolean(rawConfig.is_owned ?? true),
  };

  switch (kind) {
    case 'sitemap': {
      const homepage = ensureHttps(trimOrNull(String(rawConfig.homepage_url || '')));
      if (!homepage) return { error: 'Sitemap : "homepage_url" requis.' };
      config.homepage_url = homepage;
      const explicitSitemap = ensureHttps(trimOrNull(String(rawConfig.sitemap_url || '')));
      config.sitemap_url = explicitSitemap || null;
      const maxPages = Number(rawConfig.max_pages);
      config.max_pages = Number.isFinite(maxPages) && maxPages > 0 ? Math.min(5000, Math.round(maxPages)) : undefined;
      config.url_include = parseStringArray(rawConfig.url_include);
      config.url_exclude = parseStringArray(rawConfig.url_exclude);
      break;
    }
    case 'shopify': {
      const shopDomain = trimOrNull(String(rawConfig.shop_domain || ''))?.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      const token = trimOrNull(String(rawConfig.shopify_access_token || ''));
      if (!shopDomain) return { error: 'Shopify : "shop_domain" requis (xxx.myshopify.com).' };
      if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shopDomain)) {
        return { error: 'Shopify : domaine invalide. Format attendu : xxx.myshopify.com.' };
      }
      if (!token) return { error: 'Shopify : "shopify_access_token" requis.' };
      config.shop_domain = shopDomain;
      config.shopify_access_token = token;
      break;
    }
    case 'woocommerce': {
      const siteUrl = ensureHttps(trimOrNull(String(rawConfig.site_url || '')));
      const key = trimOrNull(String(rawConfig.consumer_key || ''));
      const secret = trimOrNull(String(rawConfig.consumer_secret || ''));
      if (!siteUrl) return { error: 'WooCommerce : "site_url" requis.' };
      if (!key || !secret) return { error: 'WooCommerce : "consumer_key" et "consumer_secret" requis.' };
      config.site_url = siteUrl;
      config.consumer_key = key;
      config.consumer_secret = secret;
      break;
    }
    case 'csv':
      // Pas de credentials ; le contenu est uploadé via l'endpoint dédié.
      break;
  }

  return { kind, name, config, defaultCategoryId };
}

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 50);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  return undefined;
}
