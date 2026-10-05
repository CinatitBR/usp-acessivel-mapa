/** One published report, as the app receives it. */
export type PublishedReport = {
  id: string;
  type: ReportType;
  answer: ReportAnswer;
  /** [lng, lat] */
  at: [number, number];
  /** Id of the building or accessibility point it is about. */
  target?: string;
  /** ISO dates. */
  since: string;
  until?: string;
  note?: string;
  /** ISO date of the last time someone said it is still so. */
  confirmed?: string;
  /** Someone has since said it changed, and no reviewer has dealt with that yet. */
  changed?: true;
};

export type ReportType = (typeof TYPES)[number];
export type ReportAnswer = (typeof PASSABLE)[number] | 'broken' | 'closed' | 'missing';

const TYPES = ['blocked', 'step', 'narrow', 'elevator', 'toilet'] as const;
const PASSABLE = ['yes', 'help', 'no'] as const;
/** Each type takes only its own answers. */
const ANSWERS: Record<ReportType, readonly ReportAnswer[]> = {
  blocked: PASSABLE,
  step: PASSABLE,
  narrow: PASSABLE,
  elevator: ['broken', 'missing'],
  toilet: ['closed', 'missing'],
};

export const MAX_NOTE = 280;
/** OSM-style ids (`way/123`) and the overlay's own (`curated/elevator-1`). */
const TARGET = /^[a-z]+\/[\w-]{1,40}$/;
/** The campus with a margin: [west, south, east, north]. */
const CAMPUS_BBOX = [-46.75, -23.58, -46.705, -23.545] as const;

/** A report as the app sends it: the same codes as a published one, without id or dates. */
export type Submission = Pick<PublishedReport, 'type' | 'answer' | 'at' | 'target' | 'note'>;

/** The largest body the app can produce is a few hundred bytes. */
export const MAX_BODY_BYTES = 2048;

/** Checks a report sent by the app. Anything that is not exactly a report is refused, with the reason. */
export function parseSubmission(json: unknown): Submission | { error: string } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'the body must be a JSON object' };
  const { type, answer, at, target, note } = json as Record<string, unknown>;
  const known = TYPES.find((candidate) => candidate === type);
  if (!known) return { error: 'unknown type' };
  const found = ANSWERS[known].find((candidate) => candidate === answer);
  if (!found) return { error: 'this type does not take this answer' };
  if (!Array.isArray(at) || at.length !== 2 || typeof at[0] !== 'number' || typeof at[1] !== 'number') return { error: 'at must be [lng, lat]' };
  const [lng, lat] = at as [number, number];
  const [west, south, east, north] = CAMPUS_BBOX;
  if (!(lng >= west && lng <= east && lat >= south && lat <= north)) return { error: 'the place is outside the campus' };
  if (target !== undefined && (typeof target !== 'string' || !TARGET.test(target))) return { error: 'target is not an id' };
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) return { error: `note must be text of at most ${MAX_NOTE} characters` };
  return {
    type: known,
    answer: found,
    at: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
    ...(typeof target === 'string' && { target }),
    ...(typeof note === 'string' && note.trim() && { note: note.trim() }),
  };
}

/** A new id for a report: short, unique enough here, and nothing in it says who sent it. */
export const newReportId = () => `r-${crypto.randomUUID().slice(0, 8)}`;

/** The shape of a report's id, for ids that arrive in an address. */
export const isReportId = (value: string) => /^[\w-]{1,40}$/.test(value);

/** Today's date in São Paulo, where the campus is, as an ISO date. */
export const todayInSaoPaulo = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);

// --- What people say later about a published report ---------------------------

export const FEEDBACK_KINDS = ['still', 'resolved', 'different'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type Feedback = { kind: FeedbackKind; note?: string };

/** Checks an answer about a report: "continua assim", "foi resolvido" or "está diferente". */
export function parseFeedback(json: unknown): Feedback | { error: string } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'the body must be a JSON object' };
  const { kind, note } = json as Record<string, unknown>;
  const known = FEEDBACK_KINDS.find((candidate) => candidate === kind);
  if (!known) return { error: `kind must be one of ${FEEDBACK_KINDS.join(', ')}` };
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) return { error: `note must be text of at most ${MAX_NOTE} characters` };
  return { kind: known, ...(typeof note === 'string' && note.trim() && { note: note.trim() }) };
}

/**
 * What the answers about one report add up to. `confirmed` is the day of the last "continua
 * assim". `changed` holds while a "mudou" that no reviewer has dealt with is newer than that:
 * a later confirmation clears it, and one person can never take a report off the map.
 * `answers` are in any order, with `createdAt` as ISO timestamps.
 */
export function summarize(answers: readonly { kind: FeedbackKind; createdAt: string; handled: boolean }[]): Pick<PublishedReport, 'confirmed' | 'changed'> {
  let lastStill = '';
  let lastChange = '';
  for (const { kind, createdAt, handled } of answers) {
    if (kind === 'still') lastStill = createdAt > lastStill ? createdAt : lastStill;
    else if (!handled) lastChange = createdAt > lastChange ? createdAt : lastChange;
  }
  return {
    ...(lastStill && { confirmed: todayInSaoPaulo(new Date(lastStill)) }),
    ...(lastChange > lastStill && { changed: true as const }),
  };
}
