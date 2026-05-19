/**
 * Adapter Shopify (Admin REST API).
 *
 * Configuration attendue :
 * - shop_domain : "ma-boutique.myshopify.com" (sans https://)
 * - shopify_access_token : token d'app privée / custom app (Admin API access token)
 *
 * Permissions requises côté custom app : `read_products`, `read_product_listings`.
 *
 * Pagination : Link header (cursor-based depuis 2019-07).
 */

import type { CatalogSourceConfig, ImportError, RawProduct } from '../types';
import { fetchWithRetry, HttpError } from '../http';
import { normalizeUrl, trimOrNull } from '../normalize';

const API_VERSION = '2024-10';
const DEFAULT_LIMIT = 250;
const HARD_CAP = 5000;

export type ShopifyAdapterArgs = {
  config: CatalogSourceConfig;
  onError?: (err: ImportError) => void;
  onProgress?: (info: { stage: string; processed: number; total?: number }) => void;
};

export async function collectShopifyProducts(args: ShopifyAdapterArgs): Promise<RawProduct[]> {
  const shopDomainRaw = trimOrNull(args.config.shop_domain);
  const token = trimOrNull(args.config.shopify_access_token);

  if (!shopDomainRaw) throw new Error('Shopify : "shop_domain" manquant.');
  if (!token) throw new Error('Shopify : "shopify_access_token" manquant.');

  const shopDomain = shopDomainRaw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shopDomain)) {
    throw new Error(`Shopify : domaine invalide "${shopDomain}". Attendu : "xxx.myshopify.com".`);
  }

  const products: RawProduct[] = [];
  const cap = Math.min(HARD_CAP, Math.max(50, Number(args.config.max_pages) || HARD_CAP));

  let nextUrl: string | null = `https://${shopDomain}/admin/api/${API_VERSION}/products.json?limit=${DEFAULT_LIMIT}&status=active`;
  let page = 0;

  while (nextUrl && products.length < cap) {
    page += 1;
    args.onProgress?.({ stage: 'shopify_page', processed: page });

    const response = await fetchWithRetry(nextUrl, {
      timeoutMs: 30_000,
      headers: { 'X-Shopify-Access-Token': token },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new HttpError(
        response.status,
        `Shopify a retourné ${response.status} : ${truncate(body, 200)}`,
        nextUrl,
      );
    }

    const json = (await response.json()) as { products?: ShopifyProduct[] };
    const items = json.products || [];

    for (const item of items) {
      try {
        const mapped = mapShopifyProduct(item, shopDomain);
        if (mapped) products.push(mapped);
      } catch (err) {
        args.onError?.({
          stage: 'parse',
          external_ref: item?.id ? `shopify:${item.id}` : null,
          product_name: item?.title || null,
          message: err instanceof Error ? err.message : 'Erreur de mapping Shopify',
        });
      }
    }

    nextUrl = parseShopifyNextLink(response.headers.get('link'));
    if (products.length >= cap) break;
  }

  return products.slice(0, cap);
}

type ShopifyImage = { src?: string };
type ShopifyVariant = { sku?: string; price?: string; barcode?: string; available?: boolean };

type ShopifyProduct = {
  id?: number;
  title?: string;
  vendor?: string;
  handle?: string;
  product_type?: string;
  body_html?: string;
  status?: string;
  tags?: string;
  images?: ShopifyImage[];
  image?: ShopifyImage;
  variants?: ShopifyVariant[];
};

function mapShopifyProduct(item: ShopifyProduct, shopDomain: string): RawProduct | null {
  if (!item?.id || !item.title) return null;

  const handle = item.handle ? `https://${shopDomain}/products/${item.handle}` : null;
  const product_url = normalizeUrl(handle);
  const image = (item.images && item.images[0]?.src) || item.image?.src || null;
  const variant = item.variants?.[0];
  const price_amount = variant?.price ? Number.parseFloat(variant.price) : null;

  const tags = (item.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    external_ref: `shopify:${item.id}`,
    product_name: item.title,
    brand_name: item.vendor || null,
    sku: variant?.sku || null,
    product_url,
    image_url: normalizeUrl(image),
    description: stripHtml(item.body_html || ''),
    category_path: item.product_type || null,
    target_keywords: tags.slice(0, 10),
    attributes: {
      handle: item.handle,
      gtin: variant?.barcode,
    },
    price_amount: Number.isFinite(price_amount as number) ? (price_amount as number) : null,
    price_currency: null,
    availability: variant?.available === false ? 'out_of_stock' : variant?.available === true ? 'in_stock' : null,
  };
}

function parseShopifyNextLink(linkHeader: string | null | undefined): string | null {
  if (!linkHeader) return null;
  // Format: <https://...>; rel="next", <https://...>; rel="previous"
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/i);
    if (match) return match[1];
  }
  return null;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function summarizeShopifyConfig(config: CatalogSourceConfig) {
  return {
    shop_domain: config.shop_domain,
    has_credentials: Boolean(config.shopify_access_token),
    brand_default: config.brand_default ?? null,
    is_owned: Boolean(config.is_owned),
  };
}
