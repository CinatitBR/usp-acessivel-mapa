import { API_BASE } from '../../config';
import type { FeedbackKind, Report } from '../../domain/reports';
import { fetchJson, ProviderError } from '../../lib/http';
import { optionalString } from '../buildings/parse';
import { parseReports } from '../reports/parse';

/** A report as a reviewer sees it: with the reporter's own note, which the map never shows. */
export type ReviewChange = { kind: Exclude<FeedbackKind, 'still'>; note?: string; createdAt: string };
export type ReviewReport = Report & {
  reporterNote?: string;
  createdAt?: string;
  /** What people said changed, that no reviewer has dealt with yet. */
  changes?: ReviewChange[];
};
export type ReviewLists = { pending: ReviewReport[]; published: ReviewReport[] };

/** What a reviewer decides. Fields left out are not changed; `null` clears one. */
export type Decision = { status: 'published' | 'refused' | 'duplicate' | 'withdrawn'; until?: string | null; publicNote?: string | null };

const PROVIDER = 'review';
const auth = (password: string) => ({ Authorization: `Bearer ${password}` });

/** True when the Worker did not accept the password. */
export const isWrongPassword = (error: unknown) => error instanceof ProviderError && error.message.endsWith('HTTP 401');

function parseChanges(list: unknown): ReviewChange[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const changes = list.flatMap((entry: Record<string, unknown> | null): ReviewChange[] => {
    const kind = entry?.kind === 'resolved' || entry?.kind === 'different' ? entry.kind : undefined;
    return kind && typeof entry?.createdAt === 'string' ? [{ kind, note: optionalString(entry.note), createdAt: entry.createdAt }] : [];
  });
  return changes.length > 0 ? changes : undefined;
}

function parseList(list: unknown): ReviewReport[] {
  if (!Array.isArray(list)) return [];
  const extras = new Map(list.map((entry: Record<string, unknown> | null) => [entry?.id, entry]));
  return parseReports({ reports: list }).map((report) => ({
    ...report,
    reporterNote: optionalString(extras.get(report.id)?.reporterNote),
    createdAt: optionalString(extras.get(report.id)?.createdAt),
    changes: parseChanges(extras.get(report.id)?.changes),
  }));
}

export function parseReview(json: unknown): ReviewLists {
  const { pending, published } = (json ?? {}) as Record<string, unknown>;
  return { pending: parseList(pending), published: parseList(published) };
}

export const fetchReview = async (password: string, signal?: AbortSignal) =>
  parseReview(await fetchJson(`${API_BASE}/review/reports`, { provider: PROVIDER, headers: auth(password), signal }));

export const sendDecision = (password: string, id: string, decision: Decision) =>
  fetchJson(`${API_BASE}/review/reports/${encodeURIComponent(id)}`, { provider: PROVIDER, headers: auth(password), body: decision });

/** The reviewer looked at what people said changed and keeps the report as it is. */
export const sendKeep = (password: string, id: string) =>
  fetchJson(`${API_BASE}/review/reports/${encodeURIComponent(id)}/keep`, { provider: PROVIDER, headers: auth(password), body: {} });
