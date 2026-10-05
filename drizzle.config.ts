import { defineConfig } from 'drizzle-kit';

/**
 * Generates the Worker's database migrations from its Drizzle schema: change
 * worker/src/schema.ts, run `npm run db:generate`, then apply the new file with
 * `npm run db:migrate:local` and `npm run db:migrate`. Wrangler applies the files; this only writes them.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/src/schema.ts',
  out: './worker/migrations',
  // Names that sort after the first, hand-written migrations (0001 to 0003).
  migrations: { prefix: 'timestamp' },
});
