import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { APP_PORT, APP_URL, ROOT, SCREENSHOTS_DIR, STATE_DIR, WORKER_PORT } from './playwright.config';
import { seedSql } from './seed';

const WRANGLER = resolve(ROOT, 'node_modules/.bin/wrangler');
const CONFIG = resolve(ROOT, 'worker/wrangler.jsonc');
const DATABASE = 'usp-campus-db';
const WORKER_URL = `http://localhost:${WORKER_PORT}`;

const wrangler = (...args: string[]) => execFileSync(WRANGLER, [...args, '-c', CONFIG], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, CI: '1' } });

async function waitFor(url: string, what: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`${what} did not start at ${url}`);
}

/**
 * Starts what the slides are taken from: a fresh local database with the reports they show,
 * the Worker over it, and the app pointed at that Worker. Returns what stops them.
 */
export default async function globalSetup() {
  rmSync(STATE_DIR, { recursive: true, force: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  wrangler('d1', 'migrations', 'apply', DATABASE, '--local', '--persist-to', STATE_DIR);
  const seed = resolve(STATE_DIR, 'seed.sql');
  writeFileSync(seed, seedSql(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())));
  wrangler('d1', 'execute', DATABASE, '--local', '--persist-to', STATE_DIR, '--file', seed, '--yes');

  const worker: ChildProcess = spawn(
    WRANGLER,
    ['dev', '-c', CONFIG, '--port', String(WORKER_PORT), '--inspector-port', String(WORKER_PORT + 1), '--persist-to', STATE_DIR, '--var', `ALLOWED_ORIGINS:${APP_URL}`, '--show-interactive-dev-session=false'],
    { cwd: ROOT, stdio: 'ignore', detached: true, env: { ...process.env, CI: '1' } },
  );
  const stopWorker = () => {
    // Wrangler runs the Worker in a child of its own: the whole group goes.
    if (worker.pid) try { process.kill(-worker.pid, 'SIGTERM'); } catch { /* Already gone. */ }
  };

  try {
    await waitFor(`${WORKER_URL}/health`, 'The Worker');
    // The repository's own Vite configuration, with `/api` led to this Worker instead of the one of `npm run worker:dev`.
    const app = await createServer({
      root: ROOT,
      logLevel: 'error',
      server: { port: APP_PORT, strictPort: true, proxy: { '/api': { target: WORKER_URL, rewrite: (path) => path.replace(/^\/api/, '') } } },
    });
    await app.listen();
    return async () => {
      await app.close();
      stopWorker();
    };
  } catch (error) {
    stopWorker();
    throw error;
  }
}
