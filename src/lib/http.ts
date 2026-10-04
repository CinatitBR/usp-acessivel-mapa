export type ProviderErrorKind = 'network' | 'http' | 'quota' | 'parse';

/** Failure of one external provider. Callers degrade only the feature that provider serves. */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
  }
}

type FetchJsonOptions = {
  provider: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** When given, the request is a POST with this value as its JSON body. */
  body?: unknown;
};

/**
 * Fetches a JSON document with a timeout (GET, or POST when a body is given). Aborts through `signal` are rethrown
 * untouched (as `AbortError`) so callers can tell a cancelled request from a
 * failed provider.
 */
export async function fetchJson(url: string, options: FetchJsonOptions): Promise<unknown> {
  const { provider, signal, timeoutMs = 10_000, headers, body } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      ...(body !== undefined && { method: 'POST', body: JSON.stringify(body) }),
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProviderError(provider, 'network', error instanceof Error ? error.message : 'request failed');
  }
  if (!response.ok) {
    throw new ProviderError(provider, response.status === 429 ? 'quota' : 'http', `HTTP ${response.status}`);
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ProviderError(provider, 'parse', 'invalid JSON');
  }
}
