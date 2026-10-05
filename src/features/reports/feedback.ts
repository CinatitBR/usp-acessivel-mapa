import { API_BASE } from '../../config';
import type { FeedbackKind } from '../../domain/reports';
import { fetchJson, ProviderError } from '../../lib/http';

const STORAGE_KEY = 'usp-map:report-answers';

/** Sends what the person says about a published report. `gone`: the report is no longer on the map. */
export async function sendFeedback(id: string, kind: FeedbackKind, note?: string): Promise<'sent' | 'gone' | 'too-many' | 'failed'> {
  if (!API_BASE) return 'failed';
  try {
    await fetchJson(`${API_BASE}/reports/${encodeURIComponent(id)}/feedback`, { provider: 'reports', body: { kind, note: note?.trim() || undefined } });
    return 'sent';
  } catch (error) {
    if (!(error instanceof ProviderError)) return 'failed';
    if (error.kind === 'quota') return 'too-many';
    return error.message.endsWith('HTTP 404') ? 'gone' : 'failed';
  }
}

/** The stored days on which this device answered about each report; what cannot be read is no answers. */
export function parseAnswered(stored: string | null): Record<string, string> {
  try {
    const value: unknown = JSON.parse(stored ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

/** One answer per report per device per day: whether this device already answered about it today. */
export function answeredToday(id: string, today: string): boolean {
  try {
    return parseAnswered(localStorage.getItem(STORAGE_KEY))[id] === today;
  } catch {
    return false;
  }
}

export function rememberAnswer(id: string, today: string) {
  try {
    // Only today's answers matter, so older ones are dropped as they are found.
    const kept = Object.fromEntries(Object.entries(parseAnswered(localStorage.getItem(STORAGE_KEY))).filter(([, day]) => day === today));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...kept, [id]: today }));
  } catch {
    // Private browsing: the buttons simply come back on the next visit.
  }
}
