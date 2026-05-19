/**
 * Helpers de normalisation pour le catalogue produits.
 */

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function clampString(value: string | null | undefined, max: number): string | null {
  const trimmed = trimOrNull(value);
  if (trimmed === null) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (trimmed === null) return null;
  try {
    const url = new URL(trimmed);
    url.hash = '';
    // Drop tracking parameters
    const TRACKING = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'gclid',
      'fbclid',
      'mc_cid',
      'mc_eid',
    ]);
    const keys = Array.from(url.searchParams.keys());
    keys.forEach((k) => {
      if (TRACKING.has(k.toLowerCase())) url.searchParams.delete(k);
    });
    return url.toString();
  } catch {
    return trimmed;
  }
}

export function ensureHttps(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (trimmed === null) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export function extractDomain(value: string | null | undefined): string | null {
  const url = ensureHttps(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function leafCategoryFromPath(path: string | null | undefined): string | null {
  const trimmed = trimOrNull(path);
  if (trimmed === null) return null;
  const parts = trimmed.split(/\s*[>/›|→]\s*/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1];
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim();
  if (!str) return null;
  // Accept "12,50" / "12.50" / "12 €" / "$12"
  const cleaned = str.replace(/[^\d,.\-]/g, '').replace(/,/g, '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseAvailability(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).toLowerCase();
  if (str.includes('instock') || str.includes('in_stock') || str.includes('disponible')) return 'in_stock';
  if (str.includes('outofstock') || str.includes('out_of_stock') || str.includes('épuisé') || str.includes('rupture'))
    return 'out_of_stock';
  if (str.includes('preorder') || str.includes('précommande')) return 'preorder';
  if (str.includes('backorder')) return 'backorder';
  return str.length > 32 ? null : str;
}

/**
 * Heuristique : telle URL ressemble-t-elle à une fiche produit ?
 * On filtre les pages catégorie / pagination / panier / blog / etc.
 */
export function looksLikeProductUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const NEGATIVE = [
    '/cart',
    '/panier',
    '/checkout',
    '/account',
    '/login',
    '/register',
    '/blog/',
    '/news/',
    '/page/',
    '/category/',
    '/categories/',
    '/categorie/',
    '/sitemap',
    '/policies/',
    '/legal',
    '/contact',
    '/search',
  ];
  if (NEGATIVE.some((needle) => lower.includes(needle))) return false;

  const POSITIVE = ['/product/', '/products/', '/produit/', '/produits/', '/item/', '/p/', '/article/'];
  if (POSITIVE.some((needle) => lower.includes(needle))) return true;

  // Sites custom : on accepte si l'URL a une profondeur > 2 et ne se termine pas par /
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    return segments.length >= 2 && !path.endsWith('/');
  } catch {
    return false;
  }
}

export function uniqByExternalRef<T extends { external_ref: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.external_ref) continue;
    const key = item.external_ref.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
