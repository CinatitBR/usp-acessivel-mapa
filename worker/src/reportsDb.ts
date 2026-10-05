import { and, asc, desc, eq, gte, isNull, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { PublishedReport, Submission } from './reports';
import type { Decision } from './review';
import { type ReportStatus, reports } from './schema';

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

/**
 * The reports reviewers have published that have not passed the end date a reviewer gave.
 * A report without one is left to the app, which knows each type's default.
 */
export async function publishedReports(d1: D1Database, today: string): Promise<PublishedReport[]> {
  const rows = await drizzle(d1)
    .select(published)
    .from(reports)
    .where(and(eq(reports.status, 'published'), or(isNull(reports.until), gte(reports.until, today))))
    .orderBy(desc(reports.since), asc(reports.id))
    .limit(MAX_PUBLISHED);
  return rows.map(toPublished);
}

/** Stores a new report, waiting for review. */
export async function insertReport(d1: D1Database, id: string, { type, answer, at, target, note }: Submission, today: string, now: string): Promise<void> {
  await drizzle(d1)
    .insert(reports)
    .values({ id, type, answer, lng: at[0], lat: at[1], target, note, since: today, status: 'pending', createdAt: now });
}

// --- For reviewers -----------------------------------------------------------

/** A report as a reviewer sees it: everything, including the reporter's own note. */
export type ReviewReport = PublishedReport & { status: ReportStatus; reporterNote?: string; createdAt: string; reviewedAt?: string };

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
  return { pending: pending.map(toReview), published: published.map(toReview) };
}

/** Applies a reviewer's decision. False when there is no such report. */
export async function decideReport(d1: D1Database, id: string, { status, until, publicNote }: Decision, now: string): Promise<boolean> {
  const changed = await drizzle(d1)
    .update(reports)
    .set({ status, reviewedAt: now, ...(until !== undefined && { until }), ...(publicNote !== undefined && { publicNote }) })
    .where(eq(reports.id, id))
    .returning({ id: reports.id });
  return changed.length > 0;
}
