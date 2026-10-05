import { API_BASE } from '../../config';
import type { Report } from '../../domain/reports';
import { fetchJson, ProviderError } from '../../lib/http';

/**
 * `sent` comes with the id the Worker gave the report, by which the app recognises it once it is
 * published. `later`: the Worker could not be reached, so the report waits on the device.
 */
export type SendResult = { status: 'sent'; id?: string } | { status: 'later' | 'refused' | 'too-many' };

/** Sends one report to the Worker, which passes it to the reviewers. Never throws. */
export async function sendReport({ type, answer, position, target, note }: Report): Promise<SendResult> {
  if (!API_BASE) return { status: 'later' };
  try {
    const answered = await fetchJson(`${API_BASE}/reports`, { provider: 'reports', body: { type, answer, at: position, target, note } });
    const id = (answered as { id?: unknown } | null)?.id;
    return { status: 'sent', ...(typeof id === 'string' && id && { id }) };
  } catch (error) {
    if (!(error instanceof ProviderError) || error.kind === 'network') return { status: 'later' };
    if (error.kind === 'quota') return { status: 'too-many' };
    // 4xx: the report itself was not accepted, and sending it again would not help. 5xx: try later.
    return { status: /HTTP 4\d\d/.test(error.message) ? 'refused' : 'later' };
  }
}
