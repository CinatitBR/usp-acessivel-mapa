/**
 * Shared by the perf scripts: one local server for the page under test and a mirror of
 * OpenFreeMap, the browser, its network and CPU throttling, and its trace. Every request
 * reaches the page over real localhost HTTP, so Chrome's network emulation applies to all.
 */
import { createHash } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { cpuByThread } from './trace';

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.pbf': 'application/x-protobuf',
};

const OFM = 'https://tiles.openfreemap.org';
/** Where the mirror answers on the local server. */
const MIRROR = '/ofm';

/** OpenFreeMap responses, fetched once and kept for every run. */
const mirrorCache = new Map<string, { type: string; body: Buffer }>();

export type Server = {
  origin: string;
  /** Points OpenFreeMap URLs in a style (or tile index) at the mirror. */
  rewrite(text: string): string;
  /** Times, since the epoch, at which a vector tile was asked for; cleared by the caller. */
  tileTimes: number[];
  close(): void;
};

/** Already compressed, or not worth it. */
const BINARY = new Set(['image/png', 'font/woff2']);
const gzipped = new Map<string, Buffer>();

/**
 * Answers like the real hosts: gzip when asked (Pages sends brotli, a little smaller), and their
 * caching: OpenFreeMap for years, Pages' /assets/ immutable, the rest revalidated by ETag.
 */
function reply(request: { headers: Record<string, string | string[] | undefined> }, response: ServerResponse, path: string, type: string, body: Buffer | string) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const etag = `"${createHash('sha1').update(buffer).digest('hex').slice(0, 16)}"`;
  const cache = path.startsWith(MIRROR) ? 'public, max-age=315360000' : path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
  const headers: Record<string, string> = { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': cache, ETag: etag };
  if (request.headers['if-none-match'] === etag) return response.writeHead(304, headers).end();
  let payload = buffer;
  if (!BINARY.has(type) && String(request.headers['accept-encoding'] ?? '').includes('gzip')) {
    payload = gzipped.get(etag) ?? gzipSync(buffer);
    gzipped.set(etag, payload);
    headers['Content-Encoding'] = 'gzip';
  }
  response.writeHead(200, headers).end(payload);
}

/** Serves `read(path)` (undefined: 404) and mirrors OpenFreeMap under /ofm/. */
export async function serve(read: (path: string, server: Server) => Buffer | string | undefined): Promise<Server> {
  const self = { tileTimes: [] as number[] } as Server;
  const mirror = async (path: string) => {
    let hit = mirrorCache.get(path);
    if (!hit) {
      // Node's fetch: behind an HTTPS proxy it follows NODE_USE_ENV_PROXY=1.
      const response = await fetch(OFM + path);
      if (!response.ok) return undefined;
      const type = response.headers.get('content-type') ?? 'application/octet-stream';
      const body = Buffer.from(await response.arrayBuffer());
      hit = { type, body: type.includes('json') ? Buffer.from(self.rewrite(body.toString('utf8'))) : body };
      mirrorCache.set(path, hit);
    }
    return hit;
  };
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const send = (type: string, body: Buffer | string | undefined) =>
      body === undefined ? response.writeHead(404).end() : reply(request, response, path, type, body);
    if (path.startsWith(`${MIRROR}/`)) {
      const upstream = path.slice(MIRROR.length);
      if (upstream.endsWith('.pbf') && !upstream.startsWith('/fonts/')) self.tileTimes.push(Date.now());
      mirror(upstream).then((hit) => send(hit?.type ?? '', hit?.body), () => send('', undefined));
      return;
    }
    send((path.endsWith('/') ? 'text/html' : TYPES[extname(path)]) ?? 'application/octet-stream', read(path, self));
  });
  await new Promise<void>((done) => server.listen(0, done));
  self.origin = `http://localhost:${(server.address() as AddressInfo).port}`;
  self.rewrite = (text) => text.replaceAll(OFM, self.origin + MIRROR);
  self.close = () => server.close();
  return self;
}

export function launch(): Promise<Browser> {
  return chromium.launch({
    ...(process.env.PERF_CHROMIUM ? { executablePath: process.env.PERF_CHROMIUM } : { channel: 'chrome' }),
    // WebGL in headless Chrome needs these (as in scripts/journey/playwright.config.ts).
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
}

/** A phone-sized context. Software WebGL makes extra pixels cost far more than on a GPU, so 1×. */
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } as const;

/** Network profiles for `--net`: round trip, and download/upload in bytes per second. */
export const NETWORKS = {
  none: undefined,
  /** A good 4G connection. */
  '4g': { latency: 100, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  /** Lighthouse's mobile profile ("slow 4G"). */
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
} as const;
export type Network = keyof typeof NETWORKS;

/** Slows the page's CPU and network and starts tracing; the returned function stops and splits CPU time at `mark`. */
export async function startProfile(browser: Browser, context: BrowserContext, page: Page, cpuRate: number, network: Network) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const conditions = NETWORKS[network];
  if (conditions) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...conditions });
  }
  await browser.startTracing(page, { categories: ['toplevel', 'disabled-by-default-devtools.timeline', 'blink.user_timing', '__metadata'] });
  return async (mark: string) => {
    const trace = JSON.parse((await browser.stopTracing()).toString('utf8')) as { traceEvents: unknown[] };
    return cpuByThread(trace.traceEvents, mark);
  };
}

export const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

export function table(title: string, columns: readonly string[], rows: { name: string; values: number[] }[]) {
  console.log(`${title}\n`);
  console.log(`| run | ${columns.join(' | ')} |`);
  console.log(`|---|${columns.map(() => '---').join('|')}|`);
  for (const row of rows) console.log(`| ${row.name} | ${row.values.join(' | ')} |`);
}
