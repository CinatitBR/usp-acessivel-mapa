/**
 * Downloads the pages listed in data/knowledge/sources.json and keeps their readable text in
 * data/knowledge/raw/ (not committed), for `knowledge:draft`. Polite: it says who it is, asks
 * robots.txt first, waits between requests to the same site, and keeps what it fetched for a day.
 *
 * Usage: npm run knowledge:fetch [-- --topic extensao] [-- --force]
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { extractLinks, htmlToText } from './lib/htmlText';
import { parseSources, rawIndexPath, rawPagePath } from './lib/knowledgeSources';
import { robotsAllows } from './lib/robots';

const USER_AGENT = 'MapaUSPButanta-knowledge/1.0 (mapa não oficial do campus; coleta manual de fontes)';
const SAME_HOST_DELAY_MS = 1500;
const FRESH_MS = 24 * 60 * 60 * 1000;
/** Sites whose pages need a sign-in or whose terms forbid scraping: the entry keeps just the link. */
const SKIPPED_HOSTS = /(^|\.)(instagram\.com|facebook\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com)$/;

const args = process.argv.slice(2);
const topic = args.includes('--topic') ? args[args.indexOf('--topic') + 1] : undefined;
const force = args.includes('--force');

const parsed = parseSources(JSON.parse(readFileSync('data/knowledge/sources.json', 'utf8')));
if ('error' in parsed) {
  console.error(parsed.error);
  process.exit(1);
}
const sources = parsed.ok;

const lastRequest = new Map<string, number>();
const robots = new Map<string, string>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function politeFetch(url: string): Promise<string | undefined> {
  const { host, origin, pathname, search } = new URL(url);
  if (SKIPPED_HOSTS.test(host)) {
    console.log(`  skip ${url} (sign-in or terms)`);
    return undefined;
  }
  const wait = (lastRequest.get(host) ?? 0) + SAME_HOST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  if (!robots.has(host)) {
    const response = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } }).catch(() => undefined);
    robots.set(host, response?.ok ? await response.text() : '');
    lastRequest.set(host, Date.now());
    await sleep(SAME_HOST_DELAY_MS);
  }
  if (!robotsAllows(robots.get(host)!, USER_AGENT, pathname + search)) {
    console.log(`  skip ${url} (robots.txt)`);
    return undefined;
  }
  lastRequest.set(host, Date.now());
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(20_000) }).catch((error: unknown) => {
    console.log(`  fail ${url}: ${error instanceof Error ? error.message : error}`);
    return undefined;
  });
  if (!response) return undefined;
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('html')) {
    console.log(`  fail ${url}: HTTP ${response.status} ${response.headers.get('content-type') ?? ''}`);
    return undefined;
  }
  return response.text();
}

const fresh = (path: string) => !force && existsSync(path) && Date.now() - statSync(path).mtimeMs < FRESH_MS;
const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

for (const page of sources.pages.filter((candidate) => !topic || candidate.topic === topic)) {
  const path = rawPagePath(page);
  if (fresh(path)) continue;
  const parts: string[] = [];
  for (const url of page.urls) {
    const html = await politeFetch(url);
    if (html) parts.push(`URL: ${url}\n\n${htmlToText(html)}`);
  }
  if (parts.length > 0) {
    write(path, `${parts.join('\n\n---\n\n')}\n`);
    console.log(`page  ${page.topic}/${page.id}`);
  }
}

for (const index of sources.indexes.filter((candidate) => !topic || candidate.topic === topic)) {
  const path = rawIndexPath(index);
  if (fresh(path)) continue;
  const html = await politeFetch(index.url);
  if (!html) continue;
  write(path, `${JSON.stringify({ ...index, text: htmlToText(html, index.url), links: extractLinks(html, index.url) }, null, 2)}\n`);
  console.log(`index ${index.topic} ${index.url}`);
}
