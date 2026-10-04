/**
 * Tries each provider in order and returns the first usable result, together
 * with the id of the provider that gave it and the ids of those that threw
 * before it.
 *
 * - A provider that throws is skipped.
 * - A result that is not `isUsable` (for example an empty list) is kept as a
 *   last resort while the remaining providers are tried.
 * - If every provider throws, the last error is rethrown.
 * - A cancelled request (`AbortError`) stops the chain at once.
 */
export async function withFallback<P extends { id: string }, T>(
  providers: readonly P[],
  call: (provider: P) => Promise<T>,
  isUsable: (value: T) => boolean = () => true,
): Promise<{ provider: string; value: T; failed: string[] }> {
  const failed: string[] = [];
  let lastResort: { provider: string; value: T } | undefined;
  let lastError: unknown = new Error('no providers');

  for (const provider of providers) {
    try {
      const value = await call(provider);
      if (isUsable(value)) return { provider: provider.id, value, failed };
      lastResort ??= { provider: provider.id, value };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      lastError = error;
      failed.push(provider.id);
    }
  }

  if (lastResort) return { ...lastResort, failed };
  throw lastError;
}
