import { API_BASE } from '../../config';
import type { Report } from '../../domain/reports';
import { fetchJson, ProviderError } from '../../lib/http';
import { optionalString } from '../buildings/parse';
import { parseReports } from '../reports/parse';

/** A report as a reviewer sees it: with the reporter's own note, which the map never shows. */
export type ReviewReport = Report & { reporterNote?: string; createdAt?: string };
export type ReviewLists = { pending: ReviewReport[]; published: ReviewReport[] };

/** What a reviewer decides. Fields left out are not changed; `null` clears one. */
export type Decision = { status: 'published' | 'refused' | 'duplicate' | 'withdrawn'; until?: string | null; publicNote?: string | null };

const PROVIDER = 'review';
const auth = (password: string) => ({ Authorization: `Bearer ${password}` });

/** True when the Worker did not accept the password. */
export const isWrongPassword = (error: unknown) => error instanceof ProviderError && error.message.endsWith('HTTP 401');

function parseList(list: unknown): ReviewReport[] {
  if (!Array.isArray(list)) return [];
  const extras = new Map(list.map((entry: Record<string, unknown> | null) => [entry?.id, entry]));
  return parseReports({ reports: list }).map((report) => ({
    ...report,
    reporterNote: optionalString(extras.get(report.id)?.reporterNote),
    createdAt: optionalString(extras.get(report.id)?.createdAt),
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
