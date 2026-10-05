import { MAX_NOTE } from './reports';
import { REPORT_STATUSES, type ReportStatus } from './schema';

const encoder = new TextEncoder();
const digest = (text: string) => crypto.subtle.digest('SHA-256', encoder.encode(text));

/**
 * Whether the request carries the reviewers' password (`Authorization: Bearer …`). Both sides
 * are hashed first, so the comparison takes the same time whatever was sent, and its length
 * tells nothing. Without a password set on the Worker, nobody is a reviewer.
 */
export async function isReviewer(authorization: string | null, password: string | undefined): Promise<boolean> {
  if (!password) return false;
  const sent = /^Bearer (.+)$/.exec(authorization ?? '')?.[1] ?? '';
  const [a, b] = await Promise.all([digest(sent), digest(password)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/** What a reviewer decides about a report. Fields left out are not changed; `null` clears one. */
export type Decision = { status: ReportStatus; until?: string | null; publicNote?: string | null };

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Checks a reviewer's decision. The password proves who sent it, not that it makes sense. */
export function parseDecision(json: unknown): Decision | { error: string } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'the body must be a JSON object' };
  const { status, until, publicNote } = json as Record<string, unknown>;
  const known = REPORT_STATUSES.find((candidate) => candidate === status);
  if (!known) return { error: `status must be one of ${REPORT_STATUSES.join(', ')}` };
  if (until !== undefined && until !== null && (typeof until !== 'string' || !isDate(until))) return { error: 'until must be a date like 2026-10-30, or null' };
  if (publicNote !== undefined && publicNote !== null && (typeof publicNote !== 'string' || publicNote.length > MAX_NOTE)) {
    return { error: `publicNote must be text of at most ${MAX_NOTE} characters, or null` };
  }
  return {
    status: known,
    ...(until !== undefined && { until: until as string | null }),
    // An empty note is no note.
    ...(publicNote !== undefined && { publicNote: typeof publicNote === 'string' && publicNote.trim() ? publicNote.trim() : null }),
  };
}
