import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ReportAnswer, ReportType } from './reports';

/**
 * The tables of the D1 database, for Drizzle. They are created by the SQL files in
 * worker/migrations/, which `wrangler d1 migrations apply` runs; a change here needs a new
 * migration there that says the same thing.
 */

/** `withdrawn`: it was published and a reviewer took it off the map, for instance because it was resolved. */
export const REPORT_STATUSES = ['pending', 'published', 'refused', 'duplicate', 'withdrawn'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** A report made on the map. Nothing about the sender is stored. */
export const reports = sqliteTable(
  'reports',
  {
    /** `r-xxxxxxxx`, made by the Worker. */
    id: text('id').primaryKey(),
    type: text('type').$type<ReportType>().notNull(),
    answer: text('answer').$type<ReportAnswer>().notNull(),
    lng: real('lng').notNull(),
    lat: real('lat').notNull(),
    /** Id of the building or accessibility point it is about. */
    target: text('target'),
    /** As the reporter wrote it; never served publicly. */
    note: text('note'),
    /** What the reviewer chose to publish. */
    publicNote: text('public_note'),
    /** ISO date in São Paulo. */
    since: text('since').notNull(),
    /** ISO date, set by a reviewer: the last day it shows. */
    until: text('until'),
    status: text('status').$type<ReportStatus>().notNull().default('pending'),
    /** ISO timestamps. */
    createdAt: text('created_at').notNull(),
    reviewedAt: text('reviewed_at'),
  },
  (table) => [index('reports_status').on(table.status)],
);

export const FEEDBACK_KINDS = ['still', 'resolved', 'different'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** What someone said later about a published report: it is still so, or it changed. */
export const reportFeedback = sqliteTable(
  'report_feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reportId: text('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<FeedbackKind>().notNull(),
    /** Never served publicly. */
    note: text('note'),
    createdAt: text('created_at').notNull(),
    /** Set when a reviewer has dealt with it. */
    handledAt: text('handled_at'),
  },
  (table) => [index('report_feedback_report').on(table.reportId)],
);
