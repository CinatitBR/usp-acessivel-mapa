import type { MyReport } from '../../domain/reports';
import { parseReports } from './parse';

const STORAGE_KEY = 'usp-map:my-reports';
/** A person's own report stays on their map this long; by then it was published or refused. */
export const MINE_DAYS = 14;
const DAY_MS = 86_400_000;

/** Reads the stored list; what cannot be read, and what is older than `MINE_DAYS` on `today`, is dropped. */
export function parseMine(stored: string | null, today: string): MyReport[] {
  if (stored === null) return [];
  let list: unknown;
  try {
    list = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - MINE_DAYS * DAY_MS).toISOString().slice(0, 10);
  // Stored in the Worker's shape plus `sent`, so one parser checks both.
  const sent = new Map(list.map((entry: { id?: unknown; sent?: unknown }) => [entry?.id, entry?.sent === true]));
  return parseReports({ reports: list })
    .filter((report) => report.since >= oldest)
    .map((report) => ({ ...report, sent: sent.get(report.id) ?? false }));
}

const serialize = (mine: readonly MyReport[]) =>
  JSON.stringify(mine.map(({ position, ...rest }) => ({ ...rest, at: position })));

export function readMine(today: string): MyReport[] {
  try {
    return parseMine(localStorage.getItem(STORAGE_KEY), today);
  } catch {
    return [];
  }
}

export function storeMine(mine: readonly MyReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(mine));
  } catch {
    // Private browsing: the reports last for this visit only.
  }
}

export const serializeMine = serialize;
