/**
 * data/knowledge/sources.json: the pages each entry is written from, and index pages that list
 * many groups at once (a faculty's list of extension groups, say), from which `knowledge:draft --index`
 * proposes new pages.
 */
import type { Parsed } from './knowledge';

export type SourcePage = { id: string; topic: string; urls: string[]; place?: string };
export type SourceIndex = { topic: string; url: string; about: string };
export type SourceList = { pages: SourcePage[]; indexes: SourceIndex[] };

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_PATTERN = /^https?:\/\/\S+$/;

export function parseSources(json: unknown): Parsed<SourceList> {
  const { pages, indexes } = (json ?? {}) as { pages?: unknown; indexes?: unknown };
  if (!Array.isArray(pages) || !Array.isArray(indexes)) return { error: 'sources.json needs "pages" and "indexes" lists' };
  const ids = new Set<string>();
  for (const page of pages as SourcePage[]) {
    if (!ID.test(page?.id ?? '') || !ID.test(page?.topic ?? '')) return { error: `bad id or topic: ${JSON.stringify(page)}` };
    if (ids.has(page.id)) return { error: `the id ${page.id} is used twice` };
    ids.add(page.id);
    if (!Array.isArray(page.urls) || page.urls.length === 0 || !page.urls.every((url) => URL_PATTERN.test(url))) return { error: `${page.id}: urls must be a list of URLs` };
  }
  for (const index of indexes as SourceIndex[]) {
    if (!ID.test(index?.topic ?? '') || !URL_PATTERN.test(index?.url ?? '') || typeof index.about !== 'string') return { error: `bad index: ${JSON.stringify(index)}` };
  }
  return { ok: { pages: pages as SourcePage[], indexes: indexes as SourceIndex[] } };
}

/** `Grupo Turing — IA` → `grupo-turing-ia`: an id for a page proposed from an index. */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');
}

/** Pages proposed from an index that are not in the list yet (by URL), with ids that do not clash. */
export function addProposals(list: SourceList, topic: string, proposals: { name: string; url: string }[]): SourcePage[] {
  const knownUrls = new Set(list.pages.flatMap((page) => page.urls));
  const ids = new Set(list.pages.map((page) => page.id));
  const added: SourcePage[] = [];
  for (const { name, url } of proposals) {
    if (!URL_PATTERN.test(url) || knownUrls.has(url)) continue;
    const base = slug(name) || 'pagina';
    let id = base;
    for (let n = 2; ids.has(id); n += 1) id = `${base}-${n}`;
    ids.add(id);
    knownUrls.add(url);
    const page = { id, topic, urls: [url] };
    list.pages.push(page);
    added.push(page);
  }
  return added;
}

export const rawPagePath = (page: SourcePage) => `data/knowledge/raw/${page.topic}/${page.id}.txt`;
export const rawIndexPath = (index: SourceIndex) => `data/knowledge/raw/_index/${slug(index.url)}.json`;
