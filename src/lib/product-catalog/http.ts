/**
 * Helpers HTTP communs aux adapters.
 * - User-Agent identifiant Quorum (politesse + traçabilité).
 * - Timeout configurable par requête.
 * - Retry exponentiel léger pour les 5xx / network errors.
 */

const DEFAULT_USER_AGENT =
  'QuorumBot/1.0 (+https://quorum.so/bot; product visibility crawler)';

export type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public url: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function fetchOnce(url: string, options: FetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: '*/*',
        'Accept-Language': 'fr,en;q=0.8',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const retries = options.retries ?? 2;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchOnce(url, options);
      if (response.status >= 500) {
        lastErr = new HttpError(response.status, `Status ${response.status}`, url);
        if (attempt < retries) {
          await sleep(250 * Math.pow(2, attempt));
          continue;
        }
        return response;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(250 * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchWithRetry failed');
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const res = await fetchWithRetry(url, options);
  if (!res.ok) {
    throw new HttpError(res.status, `HTTP ${res.status} on ${url}`, url);
  }
  return await res.text();
}

export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const res = await fetchWithRetry(url, options);
  if (!res.ok) {
    throw new HttpError(res.status, `HTTP ${res.status} on ${url}`, url);
  }
  return (await res.json()) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Limite la concurrence d'un map asynchrone. */
export async function mapWithConcurrency<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const limit = Math.max(1, Math.min(concurrency, 16));
  const results: TOut[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        // L'erreur est levée pour que l'appelant puisse la collecter via try/catch dans worker.
        throw err;
      }
    }
  }

  const runners = Array.from({ length: limit }, () => next());
  await Promise.all(runners);
  return results;
}
