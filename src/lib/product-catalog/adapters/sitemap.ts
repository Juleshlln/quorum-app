/**
 * Adapter Sitemap : découvre les URLs produits depuis robots.txt / sitemap.xml,
 * extrait les attributs depuis le JSON-LD `Product` ou les meta OpenGraph.
 *
 * Limites V1 :
 * - Cap par défaut à 1500 URLs (configurable via config.max_pages).
 * - Concurrence 6 requêtes en parallèle, retry léger sur 5xx.
 * - Si le site bloque le crawl ou n'expose pas de JSON-LD, on log et on skip.
 */

import type { CatalogSourceConfig, ImportError, RawProduct } from '../types';
import { ensureHttps, extractDomain, looksLikeProductUrl, normalizeUrl, trimOrNull } from '../normalize';
import { fetchText, mapWithConcurrency, HttpError } from '../http';

const DEFAULT_MAX_PAGES = 1500;
const FETCH_CONCURRENCY = 6;
const HARD_CAP = 5000;

export type SitemapAdapterArgs = {
  config: CatalogSourceConfig;
  onError?: (err: ImportError) => void;
  onProgress?: (info: { stage: string; processed: number; total?: number }) => void;
  signal?: AbortSignal;
};

export async function collectSitemapProducts(args: SitemapAdapterArgs): Promise<RawProduct[]> {
  const homepage = ensureHttps(args.config.homepage_url || args.config.sitemap_url || '');
  if (!homepage) {
    throw new Error('URL du site manquante pour la source Sitemap.');
  }

  const maxPages = Math.min(
    HARD_CAP,
    Math.max(10, Number(args.config.max_pages) || DEFAULT_MAX_PAGES),
  );
  const includes = (args.config.url_include || []).map((p) => p.toLowerCase()).filter(Boolean);
  const excludes = (args.config.url_exclude || []).map((p) => p.toLowerCase()).filter(Boolean);

  const sitemapUrls = await discoverSitemaps({
    explicitSitemap: args.config.sitemap_url || null,
    homepage,
    onError: args.onError,
  });

  args.onProgress?.({ stage: 'sitemap', processed: 0, total: sitemapUrls.length });

  const productUrls: string[] = [];
  const seenUrls = new Set<string>();

  for (const sitemapUrl of sitemapUrls) {
    if (productUrls.length >= maxPages) break;
    try {
      const xml = await fetchText(sitemapUrl, { timeoutMs: 20_000 });
      const { sitemaps, urls } = parseSitemap(xml);
      // Sitemap index : on récurse sur chaque sous-sitemap (cap simple)
      for (const subSitemap of sitemaps) {
        if (productUrls.length >= maxPages) break;
        try {
          const subXml = await fetchText(subSitemap, { timeoutMs: 20_000 });
          const sub = parseSitemap(subXml);
          for (const url of sub.urls) {
            if (productUrls.length >= maxPages) break;
            if (acceptUrl(url, includes, excludes) && !seenUrls.has(url)) {
              seenUrls.add(url);
              productUrls.push(url);
            }
          }
        } catch (err) {
          args.onError?.({
            stage: 'fetch',
            message: `Sitemap imbriqué ${subSitemap} : ${formatErr(err)}`,
          });
        }
      }
      for (const url of urls) {
        if (productUrls.length >= maxPages) break;
        if (acceptUrl(url, includes, excludes) && !seenUrls.has(url)) {
          seenUrls.add(url);
          productUrls.push(url);
        }
      }
    } catch (err) {
      args.onError?.({
        stage: 'fetch',
        message: `Sitemap ${sitemapUrl} : ${formatErr(err)}`,
      });
    }
  }

  if (productUrls.length === 0) {
    throw new Error(
      'Aucune URL produit détectée dans le sitemap. Vérifiez que le site expose un sitemap.xml valide.',
    );
  }

  args.onProgress?.({ stage: 'fetch_pages', processed: 0, total: productUrls.length });

  const products: RawProduct[] = [];
  let processed = 0;

  await mapWithConcurrency(productUrls, FETCH_CONCURRENCY, async (url) => {
    if (args.signal?.aborted) return null;
    try {
      const html = await fetchText(url, { timeoutMs: 15_000 });
      const product = extractProductFromHtml(html, url);
      if (product) products.push(product);
    } catch (err) {
      args.onError?.({
        stage: 'fetch',
        message: `Page ${url} : ${formatErr(err)}`,
      });
    } finally {
      processed += 1;
      if (processed % 25 === 0) {
        args.onProgress?.({ stage: 'fetch_pages', processed, total: productUrls.length });
      }
    }
    return null;
  });

  args.onProgress?.({ stage: 'fetch_pages', processed, total: productUrls.length });
  return products;
}

/* -------------------------------------------------------------------------- */
/*  Découverte des sitemaps                                                   */
/* -------------------------------------------------------------------------- */

async function discoverSitemaps(args: {
  explicitSitemap: string | null;
  homepage: string;
  onError?: (err: ImportError) => void;
}): Promise<string[]> {
  const found: string[] = [];

  if (args.explicitSitemap) {
    const url = normalizeUrl(args.explicitSitemap);
    if (url) found.push(url);
  }

  // robots.txt
  try {
    const origin = new URL(args.homepage).origin;
    const robotsUrl = `${origin}/robots.txt`;
    const txt = await fetchText(robotsUrl, { timeoutMs: 8_000, retries: 1 });
    const matches = Array.from(txt.matchAll(/^\s*sitemap:\s*(.+?)\s*$/gim));
    for (const match of matches) {
      const url = normalizeUrl(match[1]);
      if (url && !found.includes(url)) found.push(url);
    }
  } catch (err) {
    args.onError?.({
      stage: 'fetch',
      message: `robots.txt : ${formatErr(err)}`,
    });
  }

  if (found.length === 0) {
    // Fallback sur les emplacements standards
    try {
      const origin = new URL(args.homepage).origin;
      const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 'User-Agent': 'QuorumBot/1.0' },
          });
          if (res.ok) {
            found.push(candidate);
            break;
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return found;
}

function parseSitemap(xml: string): { sitemaps: string[]; urls: string[] } {
  const sitemaps: string[] = [];
  const urls: string[] = [];

  const isIndex = /<sitemapindex/i.test(xml);
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  for (const match of xml.matchAll(locRegex)) {
    const raw = match[1].trim();
    if (!raw) continue;
    const url = normalizeUrl(raw);
    if (!url) continue;
    if (isIndex) sitemaps.push(url);
    else urls.push(url);
  }
  return { sitemaps, urls };
}

function acceptUrl(url: string, includes: string[], excludes: string[]): boolean {
  const lower = url.toLowerCase();
  if (excludes.some((pattern) => lower.includes(pattern))) return false;
  if (includes.length > 0) {
    return includes.some((pattern) => lower.includes(pattern));
  }
  return looksLikeProductUrl(url);
}

/* -------------------------------------------------------------------------- */
/*  Extraction depuis HTML                                                     */
/* -------------------------------------------------------------------------- */

function extractProductFromHtml(html: string, url: string): RawProduct | null {
  const productJsonLd = extractJsonLdProduct(html);
  if (productJsonLd) {
    return mapJsonLdProduct(productJsonLd, url, html);
  }
  return mapOpenGraphProduct(html, url);
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  const blockRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: string[] = [];
  for (const match of html.matchAll(blockRegex)) {
    blocks.push(match[1]);
  }

  for (const raw of blocks) {
    const cleaned = raw.trim().replace(/^﻿/, '');
    if (!cleaned) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Certains sites ont des entités HTML — on tente un nettoyage basique.
      try {
        parsed = JSON.parse(cleaned.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      } catch {
        continue;
      }
    }

    const candidate = findProduct(parsed);
    if (candidate) return candidate;
  }
  return null;
}

function findProduct(node: any): Record<string, unknown> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const type = node['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
    return node;
  }
  // @graph
  if (Array.isArray(node['@graph'])) {
    return findProduct(node['@graph']);
  }
  return null;
}

function pickString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const v = pickString(item);
      if (v) return v;
    }
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = ['@id', 'url', 'name', 'value'];
    for (const key of candidates) {
      const v = pickString(obj[key]);
      if (v) return v;
    }
  }
  return null;
}

function pickNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '.');
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(value) && value.length > 0) return pickNumber(value[0]);
  return null;
}

function mapJsonLdProduct(node: Record<string, unknown>, url: string, html: string): RawProduct | null {
  const product_name = pickString(node.name);
  if (!product_name) return null;

  const brand_name = pickString(node.brand) || pickString((node as any).manufacturer);
  const sku = pickString(node.sku) || pickString(node.gtin13) || pickString(node.gtin) || pickString(node.mpn);
  const product_url = normalizeUrl(pickString(node.url) || url);
  const image_url = normalizeUrl(pickString(node.image));
  const description = pickString(node.description);

  const offers = node.offers as any;
  const offerObj = Array.isArray(offers) ? offers[0] : offers;
  const price_amount = pickNumber(offerObj?.price);
  const price_currency = pickString(offerObj?.priceCurrency);
  const availability = pickString(offerObj?.availability);

  // Catégorie (string ou breadcrumb)
  let category_path: string | null = pickString(node.category);
  if (!category_path) {
    category_path = extractBreadcrumb(html);
  }

  const external_ref = product_url || `${url}#${product_name}`;

  const attributes: Record<string, unknown> = {};
  if (node.color) attributes.color = pickString(node.color);
  if (node.material) attributes.material = pickString(node.material);
  if (node.size) attributes.size = pickString(node.size);

  return {
    external_ref,
    product_name,
    brand_name,
    sku,
    product_url,
    image_url,
    description,
    category_path,
    attributes,
    price_amount,
    price_currency,
    availability,
  };
}

function extractBreadcrumb(html: string): string | null {
  const blockRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(blockRegex)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = findBreadcrumb(parsed);
      if (items && items.length > 0) {
        return items.map((item) => item).join(' > ');
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findBreadcrumb(node: any): string[] | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBreadcrumb(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const type = node['@type'];
  if (type === 'BreadcrumbList') {
    const list = (node.itemListElement || []) as any[];
    return list
      .map((item) => pickString(item?.name) || pickString(item?.item?.name))
      .filter((s): s is string => Boolean(s));
  }
  if (Array.isArray(node['@graph'])) return findBreadcrumb(node['@graph']);
  return null;
}

function mapOpenGraphProduct(html: string, url: string): RawProduct | null {
  const og = extractOpenGraph(html);
  const ogType = og['og:type']?.toLowerCase() || '';
  const ogTitle = og['og:title'] || extractTitle(html);
  if (!ogTitle) return null;

  // On accepte og:type=product ou pages avec balises product:
  const isProductLike = ogType.includes('product') || Object.keys(og).some((k) => k.startsWith('product:'));
  if (!isProductLike && !looksLikeProductUrl(url)) {
    return null;
  }

  const brand_name = og['product:brand'] || og['og:brand'] || null;
  const sku = og['product:retailer_item_id'] || og['product:item_id'] || null;
  const image_url = normalizeUrl(og['og:image']);
  const product_url = normalizeUrl(og['og:url'] || url);
  const description = og['og:description'] || extractMetaDescription(html);

  const price_amount = og['product:price:amount'] ? Number(og['product:price:amount']) : null;
  const price_currency = og['product:price:currency'] || null;
  const availability = og['product:availability'] || null;

  return {
    external_ref: product_url || url,
    product_name: ogTitle,
    brand_name,
    sku,
    product_url,
    image_url,
    description,
    category_path: og['article:section'] || og['product:category'] || null,
    attributes: {},
    price_amount: Number.isFinite(price_amount as number) ? (price_amount as number) : null,
    price_currency,
    availability,
  };
}

function extractOpenGraph(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const metaRegex = /<meta\s+([^>]+?)\/?>/gi;
  for (const match of html.matchAll(metaRegex)) {
    const attrs = match[1];
    const propMatch = attrs.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']*)["']/i);
    if (!propMatch || !contentMatch) continue;
    const key = propMatch[1].toLowerCase();
    if (key.startsWith('og:') || key.startsWith('product:') || key === 'twitter:title') {
      out[key] = decodeEntities(contentMatch[1]);
    }
  }
  return out;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return decodeEntities(m[1].trim().slice(0, 500));
}

function extractMetaDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (!m) return null;
  return decodeEntities(m[1]);
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function formatErr(err: unknown): string {
  if (err instanceof HttpError) return `HTTP ${err.status}`;
  if (err instanceof Error) return err.message.slice(0, 200);
  return 'erreur inconnue';
}

export function summarizeSitemapConfig(config: CatalogSourceConfig): {
  homepage_url?: string;
  sitemap_url?: string | null;
  max_pages?: number;
  has_credentials: boolean;
  brand_default?: string | null;
  is_owned?: boolean;
} {
  return {
    homepage_url: config.homepage_url,
    sitemap_url: config.sitemap_url || null,
    max_pages: config.max_pages,
    has_credentials: false,
    brand_default: config.brand_default ?? null,
    is_owned: Boolean(config.is_owned),
  };
}

export { extractDomain };
