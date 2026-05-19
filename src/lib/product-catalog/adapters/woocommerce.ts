/**
 * Adapter WooCommerce (REST API v3).
 *
 * Configuration attendue :
 * - site_url : URL du site ("https://mon-site.fr")
 * - consumer_key : clé générée dans WooCommerce > Réglages > Avancé > API REST
 * - consumer_secret : secret correspondant
 *
 * Pagination : `?page=&per_page=100`. WooCommerce retourne X-WP-TotalPages.
 */

import type { CatalogSourceConfig, ImportError, RawProduct } from '../types';
import { fetchWithRetry, HttpError } from '../http';
import { ensureHttps, normalizeUrl, trimOrNull } from '../normalize';

const PER_PAGE = 100;
const HARD_CAP = 5000;

export type WooAdapterArgs = {
  config: CatalogSourceConfig;
  onError?: (err: ImportError) => void;
  onProgress?: (info: { stage: string; processed: number; total?: number }) => void;
};

export async function collectWooCommerceProducts(args: WooAdapterArgs): Promise<RawProduct[]> {
  const siteUrl = ensureHttps(trimOrNull(args.config.site_url));
  const key = trimOrNull(args.config.consumer_key);
  const secret = trimOrNull(args.config.consumer_secret);

  if (!siteUrl) throw new Error('WooCommerce : "site_url" manquant.');
  if (!key || !secret) throw new Error('WooCommerce : "consumer_key" / "consumer_secret" manquants.');

  const base = siteUrl.replace(/\/+$/, '');
  const auth = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
  const cap = Math.min(HARD_CAP, Math.max(50, Number(args.config.max_pages) || HARD_CAP));

  const products: RawProduct[] = [];
  let page = 1;
  let totalPages = 1;

  while (products.length < cap) {
    const url = `${base}/wp-json/wc/v3/products?per_page=${PER_PAGE}&page=${page}&status=publish`;
    args.onProgress?.({ stage: 'woocommerce_page', processed: page, total: totalPages });

    const response = await fetchWithRetry(url, {
      timeoutMs: 30_000,
      headers: { Authorization: auth, Accept: 'application/json' },
    });

    if (response.status === 401 || response.status === 403) {
      throw new HttpError(
        response.status,
        'WooCommerce : authentification refusée. Vérifiez les clés API et que l’utilisateur a des droits Read.',
        url,
      );
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new HttpError(
        response.status,
        `WooCommerce a retourné ${response.status} : ${body.slice(0, 200)}`,
        url,
      );
    }

    const totalPagesHeader = response.headers.get('x-wp-totalpages');
    if (totalPagesHeader) {
      const parsed = Number.parseInt(totalPagesHeader, 10);
      if (Number.isFinite(parsed) && parsed > 0) totalPages = parsed;
    }

    const items = (await response.json()) as WooProduct[];
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      try {
        const mapped = mapWooProduct(item);
        if (mapped) products.push(mapped);
      } catch (err) {
        args.onError?.({
          stage: 'parse',
          external_ref: item?.id ? `woo:${item.id}` : null,
          product_name: item?.name || null,
          message: err instanceof Error ? err.message : 'Erreur de mapping WooCommerce',
        });
      }
      if (products.length >= cap) break;
    }

    page += 1;
    if (page > totalPages) break;
  }

  return products.slice(0, cap);
}

type WooImage = { src?: string };
type WooCategory = { name?: string };
type WooAttribute = { name?: string; options?: string[] };

type WooProduct = {
  id?: number;
  name?: string;
  slug?: string;
  permalink?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  short_description?: string;
  description?: string;
  stock_status?: string;
  status?: string;
  categories?: WooCategory[];
  tags?: { name?: string }[];
  images?: WooImage[];
  attributes?: WooAttribute[];
  brands?: { name?: string }[];
};

function mapWooProduct(item: WooProduct): RawProduct | null {
  if (!item?.id || !item.name) return null;

  const product_url = normalizeUrl(item.permalink || null);
  const image = item.images?.[0]?.src || null;
  const price_amount = parsePrice(item.price || item.regular_price);

  const categoryPath = (item.categories || [])
    .map((c) => c?.name)
    .filter(Boolean)
    .join(' > ') || null;

  const tags = (item.tags || []).map((t) => t?.name).filter((n): n is string => Boolean(n));
  const brand = item.brands?.[0]?.name || extractBrandFromAttributes(item.attributes);

  const attributes: Record<string, unknown> = {};
  for (const attr of item.attributes || []) {
    if (attr?.name && Array.isArray(attr.options) && attr.options.length > 0) {
      attributes[attr.name] = attr.options.length === 1 ? attr.options[0] : attr.options;
    }
  }

  return {
    external_ref: `woo:${item.id}`,
    product_name: item.name,
    brand_name: brand || null,
    sku: item.sku || null,
    product_url,
    image_url: normalizeUrl(image),
    description: stripHtml(item.short_description || item.description || ''),
    category_path: categoryPath,
    target_keywords: tags.slice(0, 10),
    attributes,
    price_amount,
    price_currency: null,
    availability:
      item.stock_status === 'instock'
        ? 'in_stock'
        : item.stock_status === 'outofstock'
          ? 'out_of_stock'
          : item.stock_status || null,
  };
}

function extractBrandFromAttributes(attributes: WooAttribute[] | undefined): string | null {
  if (!attributes) return null;
  for (const attr of attributes) {
    if (!attr?.name) continue;
    if (/marque|brand/i.test(attr.name) && Array.isArray(attr.options) && attr.options[0]) {
      return attr.options[0];
    }
  }
  return null;
}

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export function summarizeWooConfig(config: CatalogSourceConfig) {
  return {
    site_url: config.site_url,
    has_credentials: Boolean(config.consumer_key && config.consumer_secret),
    brand_default: config.brand_default ?? null,
    is_owned: Boolean(config.is_owned),
  };
}
