import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, PHONE, serve, startProfile } from './lib';
const DIST = resolve('dist');
const server = await serve((path, { rewrite }) => { const f = join(DIST, path === '/' ? 'index.html' : path); if (!existsSync(f)) return undefined; return path.startsWith('/styles/') ? rewrite(readFileSync(f, 'utf8')) : readFileSync(f); });
const browser = await launch();
for (const pass of [0, 1]) {
  const context = await browser.newContext({ ...PHONE, serviceWorkers: 'block' });
  await context.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }));
  await context.route((url) => url.hostname !== 'localhost', (r) => r.abort());
  const page = await context.newPage();
  const stop = await startProfile(browser, context, page, 4, '4g');
  const t0 = Date.now();
  const rows: string[] = [];
  page.on('requestfinished', async (req) => { const t = req.timing(); const sizes = await req.sizes().catch(() => ({ responseBodySize: 0 })); rows.push(`${String(Math.round(t.startTime - t0 + t.requestStart)).padStart(6)} → ${String(Math.round(t.startTime - t0 + t.responseEnd)).padStart(6)}  ${String(Math.round(sizes.responseBodySize / 1024)).padStart(5)} KB  ${req.url().replace(server.origin, '').slice(0, 90)}`); });
  await page.goto(server.origin + '/');
  await page.waitForFunction(() => performance.getEntriesByName('map-first-idle').length > 0, undefined, { timeout: 300000 });
  const marks = await page.evaluate(() => ['map-load', 'map-first-idle'].map((n) => Math.round(performance.getEntriesByName(n)[0]!.startTime)));
  await stop('map-first-idle');
  if (pass) { rows.sort(); console.log(rows.join('\n')); console.log('marks', marks); }
  await context.close();
}
await browser.close(); server.close();
