/**
 * Benchmarks basemap styles alone (scripts/perf/harness.html) in a phone-sized headless
 * Chrome: the map opens on the campus, waits for its first `idle`, then pans along a fixed
 * path and waits for the tiles to catch up. A Chrome trace gives the CPU time of the main
 * thread and of MapLibre's workers, for the opening and for the pan.
 *
 * OpenFreeMap is fetched once and then served from a local mirror, so the network is the
 * same instant one for every style unless `--net` slows it. WebGL is software-rendered in
 * headless Chrome, so frame times are left out.
 *
 * Usage: npm run perf:basemap -- [--before <git rev>] [--runs 3] [--cpu 4] [--pitch 0,50] [--net none|4g|slow4g]
 * Set PERF_CHROMIUM to a Chromium binary to use it instead of the installed Chrome, and
 * NODE_USE_ENV_PROXY=1 when the network is only reachable through HTTPS_PROXY.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser } from '@playwright/test';
import { launch, median, type Network, PHONE, serve, startProfile, table } from './lib';

const { values: args } = parseArgs({
  options: {
    before: { type: 'string' },
    runs: { type: 'string', default: '3' },
    cpu: { type: 'string', default: '4' },
    pitch: { type: 'string', default: '0,50' },
    net: { type: 'string', default: 'none' },
  },
});

const STYLE = 'public/styles/campus.json';
const MAPLIBRE_DIST = resolve('node_modules/maplibre-gl/dist');
const styles: Record<string, string> = { liberty: '/ofm/styles/liberty', campus: '/styles/campus.json' };
const files = new Map<string, string>([
  ['/harness.html', readFileSync('scripts/perf/harness.html', 'utf8')],
  ['/styles/campus.json', readFileSync(STYLE, 'utf8')],
]);
if (args.before) {
  files.set('/styles/before.json', execFileSync('git', ['show', `${args.before}:${STYLE}`], { encoding: 'utf8' }));
  styles[`campus@${args.before}`] = '/styles/before.json';
}
const server = await serve((path, { rewrite }) => {
  if (path.startsWith('/maplibre/')) return readFileSync(join(MAPLIBRE_DIST, path.slice('/maplibre/'.length)));
  const file = files.get(path);
  return file && path.startsWith('/styles/') ? rewrite(file) : file;
});

const COLUMNS = ['layers', 'firstIdleMs', 'openTiles', 'openMainMs', 'openWorkerMs', 'catchUpMs', 'panTiles', 'panMainMs', 'panWorkerMs'] as const;

async function measure(browser: Browser, style: string, pitch: number): Promise<number[]> {
  const context = await browser.newContext(PHONE);
  const tileTimes = server.tileTimes;
  tileTimes.length = 0;
  const page = await context.newPage();
  const stop = await startProfile(browser, context, page, Number(args.cpu), args.net as Network);
  await page.goto(`${server.origin}/harness.html?style=${encodeURIComponent(style)}&pitch=${pitch}`);
  const wait = { timeout: 300_000 };
  await page.waitForFunction(() => performance.getEntriesByName('first-idle').length > 0, undefined, wait);
  const idleAt = Date.now();
  const handle = await page.waitForFunction(() => (window as unknown as { result?: object }).result, undefined, wait);
  const result = (await handle.jsonValue()) as { layers: number; firstIdleMs: number; catchUpMs: number };
  const cpu = await stop('first-idle');
  await context.close();
  const openTiles = tileTimes.filter((time) => time <= idleAt).length;
  const row = {
    ...result,
    openTiles,
    openMainMs: cpu.before.main,
    openWorkerMs: cpu.before.workers,
    panTiles: tileTimes.length - openTiles,
    panMainMs: cpu.after.main,
    panWorkerMs: cpu.after.workers,
  };
  return COLUMNS.map((column) => row[column]);
}

const browser = await launch();
const rows: { name: string; values: number[] }[] = [];
for (const pitch of args.pitch.split(',').map(Number)) {
  for (const [name, url] of Object.entries(styles)) {
    await measure(browser, url, pitch); // warm-up: fills the tile cache
    const runs: number[][] = [];
    for (let run = 0; run < Number(args.runs); run++) runs.push(await measure(browser, url, pitch));
    rows.push({ name: `${name}, pitch ${pitch}`, values: COLUMNS.map((_, index) => median(runs.map((values) => values[index]!))) });
    console.error(`done: ${name}, pitch ${pitch}`);
  }
}
await browser.close();
server.close();
table(`Basemap alone. CPU ×${args.cpu} slower, median of ${args.runs} runs, network ${args.net}. "open": until the first idle; "pan": the fixed pan until tiles catch up.`, COLUMNS, rows);
