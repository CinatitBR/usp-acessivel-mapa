/**
 * The chat's sources: one Markdown file per service or group in data/knowledge/entries/<topic>/<id>.md,
 * with a small front matter. Only entries marked `reviewed: true` reach the chat.
 */
import type { KnowledgePlace } from '../../src/domain/knowledge';

export type EntryPlaceRef = { kind: KnowledgePlace['kind']; id: string };

export type Entry = {
  id: string;
  title: string;
  topic: string;
  place?: EntryPlaceRef;
  sources: string[];
  /** The day someone last checked the entry against its sources, `YYYY-MM-DD`. */
  checked: string;
  /** A person read it. Drafts written by `knowledge:draft` start unreviewed and are left out of the build. */
  reviewed: boolean;
  body: string;
};

export type Parsed<T> = { ok: T } | { error: string };

const PLACE_KINDS = new Set<string>(['building', 'institute', 'poi']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OSM_ID = /^(node|way|relation)\/\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `key: value` lines and `key:` followed by `  - item` lines: all the front matter entries need. */
export function parseFrontMatter(text: string): Parsed<{ fields: Record<string, string | string[]>; body: string }> {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!match) return { error: 'missing front matter between --- lines' };
  const fields: Record<string, string | string[]> = {};
  let list: string[] | undefined;
  for (const line of match[1]!.split('\n')) {
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (!list) return { error: `list item outside a list: ${line}` };
      list.push(item[1]!.trim());
      continue;
    }
    const pair = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!pair) return { error: `cannot read line: ${line}` };
    const [, key, value] = pair as unknown as [string, string, string];
    if (value) {
      fields[key] = value.trim();
      list = undefined;
    } else {
      list = [];
      fields[key] = list;
    }
  }
  return { ok: { fields, body: match[2]!.trim() } };
}

const text = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export function parseEntry(id: string, topicDir: string, source: string): Parsed<Entry> {
  if (!ID.test(id)) return { error: `file name must be lowercase-with-dashes: ${id}` };
  const parsed = parseFrontMatter(source);
  if ('error' in parsed) return parsed;
  const { fields, body } = parsed.ok;
  const title = text(fields.title);
  const topic = text(fields.topic);
  const checked = text(fields.checked);
  const reviewed = text(fields.reviewed);
  const sources = Array.isArray(fields.sources) ? fields.sources : [];
  if (!title) return { error: 'title is required' };
  if (topic !== topicDir) return { error: `topic must match its folder (${topicDir})` };
  if (!checked || !DATE.test(checked)) return { error: 'checked must be a YYYY-MM-DD date' };
  if (reviewed !== 'true' && reviewed !== 'false') return { error: 'reviewed must be true or false' };
  if (sources.length === 0) return { error: 'at least one source URL is required' };
  for (const url of sources) if (!/^https?:\/\/\S+$/.test(url)) return { error: `not a URL: ${url}` };
  if (!body) return { error: 'the entry has no text' };

  let place: EntryPlaceRef | undefined;
  const placeText = text(fields.place);
  if (placeText) {
    const [kind, osmId, ...rest] = placeText.split(/\s+/);
    if (!kind || !PLACE_KINDS.has(kind) || !osmId || !OSM_ID.test(osmId) || rest.length > 0)
      return { error: 'place must be "<building|institute|poi> <node|way|relation>/<id>"' };
    place = { kind: kind as EntryPlaceRef['kind'], id: osmId };
  }
  return { ok: { id, title, topic, ...(place && { place }), sources, checked, reviewed: reviewed === 'true', body } };
}

/** Writes an entry back in the same format, for the drafting script. */
export function formatEntry(entry: Omit<Entry, 'id'>): string {
  const lines = ['---', `title: ${entry.title}`, `topic: ${entry.topic}`];
  if (entry.place) lines.push(`place: ${entry.place.kind} ${entry.place.id}`);
  lines.push('sources:', ...entry.sources.map((url) => `  - ${url}`), `checked: ${entry.checked}`, `reviewed: ${entry.reviewed}`, '---');
  return `${lines.join('\n')}\n${entry.body.trim()}\n`;
}

/** What the Worker bundles: the text the model reads, in a fixed order so the prompt prefix stays cacheable. */
export type KnowledgeCorpus = { entries: { id: string; title: string; topic: string; sources: string[]; checked: string; body: string }[] };

export function corpusOf(entries: Entry[]): KnowledgeCorpus {
  return {
    entries: entries
      .filter((entry) => entry.reviewed)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, title, topic, sources, checked, body }) => ({ id, title, topic, sources, checked, body })),
  };
}
