import { getDomainFromUrl, normalizeUrl } from '@/lib/sources/normalize';

function toAbsoluteCandidate(rawUrl: string, siteUrl: string | null | undefined) {
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  if (!siteUrl) {
    return rawUrl.startsWith('/') ? `https://placeholder.local${rawUrl}` : `https://placeholder.local/${rawUrl}`;
  }

  const candidateBase = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  try {
    return new URL(rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`, candidateBase).toString();
  } catch {
    return rawUrl;
  }
}

export function canonicalizePageUrl(rawUrl: string | null | undefined, siteUrl?: string | null) {
  if (!rawUrl) return null;
  const normalized = normalizeUrl(rawUrl);
  if (normalized) return normalized;

  const absolute = toAbsoluteCandidate(rawUrl, siteUrl);
  const normalizedAbsolute = normalizeUrl(absolute);
  return normalizedAbsolute || absolute;
}

export function getPagePathKey(rawUrl: string | null | undefined, siteUrl?: string | null) {
  const canonical = canonicalizePageUrl(rawUrl, siteUrl);
  if (!canonical) return null;

  try {
    const parsed = new URL(canonical);
    const search = parsed.search ? parsed.search : '';
    return `${parsed.pathname}${search}` || '/';
  } catch {
    return canonical;
  }
}

export function getCitedDomain(rawUrl: string | null | undefined) {
  return getDomainFromUrl(rawUrl);
}
