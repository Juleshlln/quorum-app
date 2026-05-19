import { createSign } from 'crypto';
import type { SupportedAnalyticsCredentials } from '@/lib/integrations/analytics/types';

/* -------------------------------------------------------------------------- */
/*  Token cache — avoids redundant JWT exchanges with Google OAuth            */
/*  Each entry is keyed by (client_email + scopes) and lives for 55 minutes.  */
/* -------------------------------------------------------------------------- */

const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min (Google tokens expire at 60 min)

type CachedToken = {
  accessToken: string;
  expiresAt: number; // Date.now() + TTL
};

const tokenCache = new Map<string, CachedToken>();

function buildCacheKey(email: string, scopes: string[]) {
  return `${email}::${scopes.slice().sort().join(',')}`;
}

function getCachedToken(key: string): string | null {
  const entry = tokenCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    tokenCache.delete(key);
    return null;
  }
  return entry.accessToken;
}

function setCachedToken(key: string, accessToken: string) {
  tokenCache.set(key, { accessToken, expiresAt: Date.now() + TOKEN_TTL_MS });
}

/* -------------------------------------------------------------------------- */

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function isServiceAccountCredentials(credentials: SupportedAnalyticsCredentials): credentials is Extract<SupportedAnalyticsCredentials, { client_email: string }> {
  return 'client_email' in credentials && 'private_key' in credentials;
}

async function exchangeServiceAccountToken(
  credentials: Extract<SupportedAnalyticsCredentials, { client_email: string }>,
  scopes: string[],
) {
  const cacheKey = buildCacheKey(credentials.client_email, scopes);
  const cached = getCachedToken(cacheKey);
  if (cached) return cached;

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: scopes.join(' '),
      aud: tokenUri,
      exp: expiresAt,
      iat: issuedAt,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(credentials.private_key);
  const assertion = `${header}.${payload}.${base64UrlEncode(signature)}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payloadJson = await response.json().catch(() => ({}));
  if (!response.ok || !payloadJson?.access_token) {
    throw new Error(payloadJson?.error_description || payloadJson?.error || 'Google token exchange failed');
  }

  const accessToken = payloadJson.access_token as string;
  setCachedToken(cacheKey, accessToken);
  return accessToken;
}

export async function getGoogleAccessToken(
  credentials: SupportedAnalyticsCredentials,
  scopes: string[],
) {
  if (isServiceAccountCredentials(credentials)) {
    return exchangeServiceAccountToken(credentials, scopes);
  }

  if ('access_token' in credentials && credentials.access_token) {
    return credentials.access_token;
  }

  throw new Error('Unsupported Google credentials format');
}

export function parseAnalyticsCredentials(raw: unknown): SupportedAnalyticsCredentials {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid credentials payload');
  }

  if (
    'client_email' in parsed &&
    typeof parsed.client_email === 'string' &&
    'private_key' in parsed &&
    typeof parsed.private_key === 'string'
  ) {
    return {
      type: 'service_account',
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: typeof parsed.token_uri === 'string' ? parsed.token_uri : undefined,
      project_id: typeof parsed.project_id === 'string' ? parsed.project_id : undefined,
    };
  }

  if ('access_token' in parsed && typeof parsed.access_token === 'string') {
    return {
      type: 'access_token',
      access_token: parsed.access_token,
    };
  }

  throw new Error('Unsupported credentials payload');
}
