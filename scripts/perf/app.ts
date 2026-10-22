/**
 * Opens the production build (dist/) in a phone-sized headless Chrome with a slowed CPU and
 * times the map: `map-load` and `map-first-idle` are marks set by src/map/CampusMap.tsx.
 * A Chrome trace gives the CPU time of the main thread and of MapLibre's workers until the
 * first idle. Each variant changes one thing, so the rows show what each part costs.
 *
 * OpenFreeMap comes from a local mirror (scripts/perf/lib.ts), so `--net` slows tiles and app
 * alike; other outside services are blocked. The service worker is off, so the first-visit
 * precache is not part of these numbers.
 *
 * Usage: npm run build && npm run perf:app -- [--runs 3] [--cpu 4] [--net none|4g|slow4g] [--waterfall]
 * `--waterfall` also prints the requests of the last run of each variant.
 * PERF_CHROMIUM and NODE_USE_ENV_PROXY=1 as in scripts/perf/basemap.ts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser } from '@playwright/test';
import { launch, median, type Network, PHONE, serve, startProfile, table } from './lib';

const { values: args } = parseArgs({ options: { runs: { type: 'string', default: '3' }, cpu: { type: 'string', default: '4' }, net: { type: 'string', default: 'none' }, waterfall: { type: 'boolean', default: false } } });

/** As CAMPUS_CENTER in src/config.ts, which cannot be imported outside Vite. */
const CAMPUS_CENTER = { longitude: -46.7283, latitude: -23.5611 };
const DIST = resolve('dist');
if (!existsSync(join(DIST, 'index.html'))) throw new Error('Run `npm run build` first.');
const server = await serve((path, { rewrite }) => {
  const file = join(DIST, path === '/' ? 'index.html' : path);
  if (!file.startsWith(DIST) || !existsSync(file)) return undefined;
  return path.startsWith('/styles/') || file.endsWith('.html') ? rewrite(readFileSync(file, 'utf8')) : readFileSync(file);
});

type Variant = { cores: number; pitch?: number; blockData?: boolean };
const VARIANTS: Record<string, Variant> = {
  '3D (8 cores)': { cores: 8 },
  'lite (4 cores)': { cores: 4 },
  'lite, pitch 0': { cores: 4, pitch: 0 },
  'lite, no campus GeoJSON': { cores: 4, blockData: true },
};

const COLUMNS = ['mapLoadMs', 'firstIdleMs', 'tiles', 'mainMs', 'workerMs'] as const;

async function measure(browser: Browser, variant: Variant, waterfall: string[] = []): Promise<number[]> {
  const context = await browser.newContext({ ...PHONE, serviceWorkers: 'block' });
  await context.addInitScript((cores) => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores }), variant.cores);
  // Live services would make runs differ; only the app itself and the basemap are let through.
  await context.route((url) => url.hostname !== 'localhost', (route) => route.abort());
  if (variant.blockData) await context.route('**/data/*.geojson', (route) => route.abort());
  const tileTimes = server.tileTimes;
  tileTimes.length = 0;
  const page = await context.newPage();
  const stop = await startProfile(browser, context, page, Number(args.cpu), args.net as Network);
  const start = Date.now();
  page.on('requestfinished', (request) => {
    const { startTime, requestStart, responseEnd } = request.timing();
    const at = (time: number) => String(Math.round(startTime - start + time)).padStart(6);
    waterfall.push(`${at(requestStart)} → ${at(responseEnd)}  ${request.url().replace(server.origin, '')}`);
  });
  const hash = variant.pitch === undefined ? '' : `#15.5/${CAMPUS_CENTER.latitude}/${CAMPUS_CENTER.longitude}/0/${variant.pitch}`;
  await page.goto(`${server.origin}/${hash}`);
  await page.waitForFunction(() => performance.getEntriesByName('map-first-idle').length > 0, undefined, { timeout: 300_000 });
  const marks = await page.evaluate(() => ['map-load', 'map-first-idle'].map((name) => Math.round(performance.getEntriesByName(name)[0]!.startTime)));
  const cpu = await stop('map-first-idle');
  await context.close();
  return [marks[0]!, marks[1]!, tileTimes.length, cpu.before.main, cpu.before.workers];
}

const browser = await launch();
const rows: { name: string; values: number[] }[] = [];
for (const [name, variant] of Object.entries(VARIANTS)) {
  await measure(browser, variant); // warm-up: fills the tile cache
  const runs: number[][] = [];
  const waterfall: string[] = [];
  for (let run = 0; run < Number(args.runs); run++) {
    waterfall.length = 0;
    runs.push(await measure(browser, variant, waterfall));
  }
  if (args.waterfall) console.log(`\n${name}\n${waterfall.sort().join('\n')}\n`);
  rows.push({ name, values: COLUMNS.map((_, index) => median(runs.map((values) => values[index]!))) });
  console.error(`done: ${name}`);
}
await browser.close();
server.close();
table(`The app, until the map's first idle. CPU ×${args.cpu} slower, median of ${args.runs} runs, network ${args.net}, no service worker.`, COLUMNS, rows);
