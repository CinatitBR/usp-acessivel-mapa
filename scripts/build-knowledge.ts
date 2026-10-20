/**
 * Checks the chat's sources in data/knowledge/entries and writes what the Worker and the app read:
 * worker/src/knowledge.generated.json (the text the model answers from) and public/data/knowledge.json
 * (titles, links and map places of the sources an answer cites). Unreviewed drafts are left out.
 *
 * Usage: npm run knowledge:build
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { geometryCenter } from '../src/domain/geo';
import type { KnowledgePlace, KnowledgeSource } from '../src/domain/knowledge';
import type { Institute, LngLat } from '../src/domain/types';
import { corpusOf, type Entry, parseEntry } from './lib/knowledge';

const ENTRIES = 'data/knowledge/entries';
const CORPUS_OUT = 'worker/src/knowledge.generated.json';
const INDEX_OUT = 'public/data/knowledge.json';

const round = ([lng, lat]: LngLat): LngLat => [Number(lng.toFixed(6)), Number(lat.toFixed(6))];

function placeCentres(): Map<string, LngLat> {
  const centres = new Map<string, LngLat>();
  for (const name of ['buildings', 'pois']) {
    const collection = JSON.parse(readFileSync(`public/data/${name}.geojson`, 'utf8')) as FeatureCollection;
    for (const feature of collection.features) {
      const centre = geometryCenter(feature.geometry);
      if (centre) centres.set(`${name === 'buildings' ? 'building' : 'poi'} ${String(feature.properties?.id)}`, round(centre));
    }
  }
  for (const institute of JSON.parse(readFileSync('public/data/institutes.json', 'utf8')) as Institute[])
    centres.set(`institute ${institute.id}`, institute.center);
  return centres;
}

const entries: Entry[] = [];
const problems: string[] = [];
for (const topic of readdirSync(ENTRIES).sort()) {
  for (const file of readdirSync(join(ENTRIES, topic)).sort()) {
    if (!file.endsWith('.md')) continue;
    const parsed = parseEntry(file.slice(0, -3), topic, readFileSync(join(ENTRIES, topic, file), 'utf8'));
    if ('error' in parsed) problems.push(`${topic}/${file}: ${parsed.error}`);
    else entries.push(parsed.ok);
  }
}

const seen = new Set<string>();
for (const entry of entries) {
  if (seen.has(entry.id)) problems.push(`${entry.topic}/${entry.id}.md: the id is used twice`);
  seen.add(entry.id);
}

const centres = placeCentres();
const index: KnowledgeSource[] = [];
const corpus = corpusOf(entries);
for (const { id } of corpus.entries) {
  const entry = entries.find((candidate) => candidate.id === id)!;
  let place: KnowledgePlace | undefined;
  if (entry.place) {
    const position = centres.get(`${entry.place.kind} ${entry.place.id}`);
    if (position) place = { ...entry.place, position };
    else problems.push(`${entry.topic}/${id}.md: no ${entry.place.kind} ${entry.place.id} in public/data`);
  }
  index.push({ id, title: entry.title, url: entry.sources[0]!, ...(place && { place }) });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

writeFileSync(CORPUS_OUT, `${JSON.stringify(corpus, null, 2)}\n`);
writeFileSync(INDEX_OUT, JSON.stringify(index));
const drafts = entries.length - corpus.entries.length;
console.log(`Knowledge: ${corpus.entries.length} entries${drafts ? `, ${drafts} unreviewed drafts left out` : ''}`);
