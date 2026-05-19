const TRACKING_PARAMS = new Set([
  'gclid',
  'fbclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'ref',
  'ref_src',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]);

const MULTI_PART_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'co.jp',
  'ne.jp',
  'or.jp',
  'com.au',
  'net.au',
  'org.au',
  'com.br',
  'com.mx',
  'com.ar',
  'com.tr',
  'com.cn',
  'com.tw',
  'com.sg',
  'com.hk',
  'com.sa',
  'com.ua',
  'com.pl',
  'com.pt',
  'com.es',
  'com.de',
  'com.fr',
  'co.in',
  'co.id',
  'co.kr',
]);

function isIpAddress(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  return value.replace(/^www\./, '').replace(/\.$/, '');
}

export function getRegistrableDomain(hostname: string | null | undefined): string | null {
  const normalized = normalizeDomain(hostname);
  if (!normalized) return null;
  if (isIpAddress(normalized)) return normalized;
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length <= 2) return normalized;
  const lastTwo = parts.slice(-2).join('.');
  const lastThree = parts.slice(-3).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  if (MULTI_PART_SUFFIXES.has(lastThree)) {
    return parts.slice(-4).join('.');
  }
  return lastTwo;
}

export function getDomainFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const candidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(candidate);
    return getRegistrableDomain(parsed.hostname);
  } catch {
    return null;
  }
}

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    url.hash = '';
    url.protocol = 'https:';
    url.hostname = normalizeDomain(url.hostname) || url.hostname.toLowerCase();

    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = '';
    }

    const params = new URLSearchParams(url.search);
    [...params.keys()].forEach((key) => {
      if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) {
        params.delete(key);
      }
    });
    const sortedParams = new URLSearchParams();
    Array.from(params.keys())
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        const values = params.getAll(key);
        values.forEach((value) => sortedParams.append(key, value));
      });
    url.search = sortedParams.toString();

    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    if (!url.pathname) {
      url.pathname = '/';
    }

    return url.toString();
  } catch {
    return null;
  }
}
