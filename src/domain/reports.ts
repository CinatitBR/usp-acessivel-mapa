import type { AccessStatus, LngLat } from './types';

export const REPORT_TYPES = ['blocked', 'step', 'narrow', 'elevator', 'toilet'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** For a passage, a step or a sidewalk: can a wheelchair get through? */
export const PASSABLE_ANSWERS = ['yes', 'help', 'no'] as const;
/**
 * What the reporter said. An elevator is `broken` or `missing`, an accessible toilet
 * `closed` or `missing`; the other types answer whether one can get through.
 */
export type ReportAnswer = (typeof PASSABLE_ANSWERS)[number] | 'broken' | 'closed' | 'missing';

export const REPORT_ANSWERS: Record<ReportType, readonly ReportAnswer[]> = {
  blocked: PASSABLE_ANSWERS,
  step: PASSABLE_ANSWERS,
  narrow: PASSABLE_ANSWERS,
  elevator: ['broken', 'missing'],
  toilet: ['closed', 'missing'],
};

/** Something a person reported on the map and a reviewer published. */
export interface Report {
  id: string;
  type: ReportType;
  answer: ReportAnswer;
  position: LngLat;
  /** Id of the building or accessibility point it is about. */
  target?: string;
  /** ISO date it was reported. */
  since: string;
  /** ISO date after which it no longer shows. Temporary reports without one get a default. */
  until?: string;
  note?: string;
}

/**
 * Temporary reports are about something that will end by itself (works, a broken elevator);
 * the others describe the place as it is built. The type and the answer decide, never the reporter.
 */
export const isTemporary = ({ type, answer }: Pick<Report, 'type' | 'answer'>) =>
  type === 'blocked' || answer === 'broken' || answer === 'closed';

/** Days a temporary report shows when the reviewer gave no end date. First guesses, to be tuned. */
const DEFAULT_DAYS: Partial<Record<ReportType, number>> = { blocked: 7, elevator: 14, toilet: 14 };

const DAY_MS = 86_400_000;

/** The last day a report shows, as an ISO date; nothing for a permanent report without an end date. */
export function lastDay(report: Report): string | undefined {
  if (report.until) return report.until;
  const days = isTemporary(report) ? DEFAULT_DAYS[report.type] : undefined;
  const start = Date.parse(`${report.since}T00:00:00Z`);
  if (days === undefined || Number.isNaN(start)) return undefined;
  return new Date(start + days * DAY_MS).toISOString().slice(0, 10);
}

/** `today` is an ISO date. A report dated in the future is not shown yet. */
export function isActive(report: Report, today: string): boolean {
  const last = lastDay(report);
  return report.since <= today && (last === undefined || today <= last);
}

/** The accessibility status a report stands for: red when one cannot get through or use it, amber otherwise. */
export const reportStatus = ({ answer }: Pick<Report, 'answer'>): Exclude<AccessStatus, 'yes' | 'unknown'> =>
  answer === 'yes' || answer === 'help' ? 'partial' : 'no';
