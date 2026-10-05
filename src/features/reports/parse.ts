import { REPORT_ANSWERS, REPORT_TYPES, type Report, type ReportType } from '../../domain/reports';
import { optionalString } from '../buildings/parse';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value);

function parseReport(value: unknown): Report | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { id, type, answer, at, target, since, until, note, confirmed, changed } = value as Record<string, unknown>;
  const known = REPORT_TYPES.find((candidate): candidate is ReportType => candidate === type);
  const answers = known ? REPORT_ANSWERS[known] : [];
  const found = answers.find((candidate) => candidate === answer);
  if (typeof id !== 'string' || !id || !known || !found || !isDate(since)) return undefined;
  if (!Array.isArray(at) || typeof at[0] !== 'number' || typeof at[1] !== 'number') return undefined;
  return {
    id,
    type: known,
    answer: found,
    position: [at[0], at[1]],
    target: optionalString(target),
    since,
    until: isDate(until) ? until : undefined,
    note: optionalString(note),
    ...(isDate(confirmed) && { confirmed }),
    ...(changed === true && { changed }),
  };
}

/** The Worker's `/reports` answer as domain reports; entries it cannot read are left out. */
export function parseReports(json: unknown): Report[] {
  const list = (json as { reports?: unknown } | null)?.reports;
  return Array.isArray(list) ? list.map(parseReport).filter((report): report is Report => report !== undefined) : [];
}
