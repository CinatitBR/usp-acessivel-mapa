import { and, asc, desc, eq, gte, inArray, isNull, ne, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { type Feedback, type FeedbackKind, type PublishedReport, type Submission, summarize } from './reports';
import type { Decision } from './review';
import { reportFeedback, type ReportStatus, reports } from './schema';

/** How long a browser may reuse the list of published reports. */
export const REPORTS_TTL_SECONDS = 60;
const MAX_PUBLISHED = 500;

/** The columns of a report that may leave the Worker. */
const published = {
  id: reports.id,
  type: reports.type,
  answer: reports.answer,
  lng: reports.lng,
  lat: reports.lat,
  target: reports.target,
  since: reports.since,
  until: reports.until,
  publicNote: reports.publicNote,
};
type PublishedRow = Pick<typeof reports.$inferSelect, keyof typeof published>;

/** A row of the database in the shape the app receives. Only the reviewer's public note goes out. */
export const toPublished = (row: PublishedRow): PublishedReport => ({
  id: row.id,
  type: row.type,
  answer: row.answer,
  at: [row.lng, row.lat],
  ...(row.target && { target: row.target }),
  since: row.since,
  ...(row.until && { until: row.until }),
  ...(row.publicNote && { note: row.publicNote }),
});

/** A confirmation can keep a temporary report past its end date for at most this long (the longest default). */
const CONFIRMED_GRACE_DAYS = 14;
const DAY_MS = 86_400_000;

type Answer = { reportId: string; kind: FeedbackKind; createdAt: string; handled: boolean; id: number; note: string | null };

/** Every answer about the given reports, by report. */
async function answersFor(d1: D1Database, ids: readonly string[]): Promise<Map<string, Answer[]>> {
  const byReport = new Map<string, Answer[]>();
  if (ids.length === 0) return byReport;
  const rows = await drizzle(d1)
    .select()
    .from(reportFeedback)
    .where(inArray(reportFeedback.reportId, [...ids]));
  for (const row of rows) {
    const answer = { reportId: row.reportId, kind: row.kind, createdAt: row.createdAt, handled: row.handledAt !== null, id: row.id, note: row.note };
    byReport.set(row.reportId, [...(byReport.get(row.reportId) ?? []), answer]);
  }
  return byReport;
}

/**
 * The reports reviewers have published, each with what people have said about it since. One
 * whose end date passed more than `CONFIRMED_GRACE_DAYS` ago is left out; within that time the
 * app decides, since a confirmation may have kept it alive. A report without an end date is
 * left to the app too, which knows each type's default.
 */
export async function publishedReports(d1: D1Database, today: string): Promise<PublishedReport[]> {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - CONFIRMED_GRACE_DAYS * DAY_MS).toISOString().slice(0, 10);
  const rows = await drizzle(d1)
    .select(published)
    .from(reports)
    .where(and(eq(reports.status, 'published'), or(isNull(reports.until), gte(reports.until, cutoff))))
    .orderBy(desc(reports.since), asc(reports.id))
    .limit(MAX_PUBLISHED);
  const answers = await answersFor(d1, rows.map((row) => row.id));
  return rows.map((row) => ({ ...toPublished(row), ...summarize(answers.get(row.id) ?? []) }));
}

/** Stores what someone says about a published report. False when there is no such report on the map. */
export async function insertFeedback(d1: D1Database, reportId: string, { kind, note }: Feedback, now: string): Promise<boolean> {
  const db = drizzle(d1);
  const [report] = await db.select({ id: reports.id }).from(reports).where(and(eq(reports.id, reportId), eq(reports.status, 'published'))).limit(1);
  if (!report) return false;
  await db.insert(reportFeedback).values({ reportId, kind, note, createdAt: now });
  return true;
}

/** Stores a new report, waiting for review. */
export async function insertReport(d1: D1Database, id: string, { type, answer, at, target, note }: Submission, today: string, now: string): Promise<void> {
  await drizzle(d1)
    .insert(reports)
    .values({ id, type, answer, lng: at[0], lat: at[1], target, note, since: today, status: 'pending', createdAt: now });
}

// --- For reviewers -----------------------------------------------------------

/** A report as a reviewer sees it: everything, including the reporter's own note. */
export type ReviewReport = PublishedReport & {
  status: ReportStatus;
  reporterNote?: string;
  createdAt: string;
  reviewedAt?: string;
  /** The "mudou" answers no reviewer has dealt with yet, oldest first, with their notes. */
  changes?: { kind: FeedbackKind; note?: string; createdAt: string }[];
};

const MAX_REVIEW = 300;

/** The reports waiting for review, oldest first, and those on the map, newest first. */
export async function reviewReports(d1: D1Database): Promise<{ pending: ReviewReport[]; published: ReviewReport[] }> {
  const db = drizzle(d1);
  const toReview = (row: typeof reports.$inferSelect): ReviewReport => ({
    ...toPublished(row),
    status: row.status,
    ...(row.note && { reporterNote: row.note }),
    createdAt: row.createdAt,
    ...(row.reviewedAt && { reviewedAt: row.reviewedAt }),
  });
  const [pending, published] = await Promise.all([
    db.select().from(reports).where(eq(reports.status, 'pending')).orderBy(asc(reports.createdAt)).limit(MAX_REVIEW),
    db.select().from(reports).where(eq(reports.status, 'published')).orderBy(desc(reports.reviewedAt)).limit(MAX_REVIEW),
  ]);
  const answers = await answersFor(d1, published.map((row) => row.id));
  const withAnswers = (row: typeof reports.$inferSelect): ReviewReport => {
    const all = answers.get(row.id) ?? [];
    const changes = all
      .filter((answer) => answer.kind !== 'still' && !answer.handled)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ kind, note, createdAt }) => ({ kind, ...(note && { note }), createdAt }));
    return { ...toReview(row), ...summarize(all), ...(changes.length > 0 && { changes }) };
  };
  return { pending: pending.map(toReview), published: published.map(withAnswers) };
}

/** Marks every "mudou" about a report as dealt with: the reviewer looked and the report stays as it is. */
export async function keepReport(d1: D1Database, id: string, now: string): Promise<void> {
  await drizzle(d1)
    .update(reportFeedback)
    .set({ handledAt: now })
    .where(and(eq(reportFeedback.reportId, id), ne(reportFeedback.kind, 'still'), isNull(reportFeedback.handledAt)));
}

/** Applies a reviewer's decision. False when there is no such report. */
export async function decideReport(d1: D1Database, id: string, { status, until, publicNote }: Decision, now: string): Promise<boolean> {
  const changed = await drizzle(d1)
    .update(reports)
    .set({ status, reviewedAt: now, ...(until !== undefined && { until }), ...(publicNote !== undefined && { publicNote }) })
    .where(eq(reports.id, id))
    .returning({ id: reports.id });
  // Whatever was decided, the reviewer has seen what people said about it.
  if (changed.length > 0) await keepReport(d1, id, now);
  return changed.length > 0;
}
