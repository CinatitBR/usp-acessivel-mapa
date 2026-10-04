/**
 * Downloads campus OSM data once and stores the raw Overpass response in
 * data/raw/overpass.json (gitignored). The app never calls Overpass at runtime.
 *
 * Usage: npm run data:osm
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { CAMPUS_RELATIONS, CAMPUS_WAYS } from './lib/campus';

const BOUNDARIES = `relation(id:${CAMPUS_RELATIONS.join(',')});way(id:${CAMPUS_WAYS.join(',')});`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const OUTPUT = 'data/raw/overpass.json';
const MIN_ELEMENTS = 1000;

const QUERY = `
[out:json][timeout:120];
(${BOUNDARIES});map_to_area->.campus;
(
  nwr(area.campus)["building"];
  nwr(area.campus)["amenity"];
  nwr(area.campus)["shop"];
  nwr(area.campus)["leisure"];
  nwr(area.campus)["tourism"];
  nwr(area.campus)["office"];
  nwr(area.campus)["wheelchair"];
  nwr(area.campus)["entrance"];
  nwr(area.campus)["kerb"];
  node(area.campus)["highway"~"^(elevator|bus_stop|crossing)$"];
  way(area.campus)["highway"="steps"];
  way(area.campus)["highway"]["name"];
  node(area.campus)["natural"="tree"];
  way(area.campus)["natural"~"^(wood|tree_row)$"];
  way(area.campus)["landuse"="forest"];
  ${BOUNDARIES}
);
out geom;
`;

type OverpassResponse = { elements?: unknown[]; remark?: string };

async function query(endpoint: string): Promise<OverpassResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'User-Agent': 'usp-campus-map/0.1 (build script)' },
    body: new URLSearchParams({ data: QUERY }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // Some mirrors emit raw control characters inside tag values, which JSON.parse rejects.
  const text = (await response.text()).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ');
  const data = JSON.parse(text) as OverpassResponse;
  if (data.remark) throw new Error(`Overpass remark: ${data.remark}`);
  if ((data.elements?.length ?? 0) < MIN_ELEMENTS) {
    throw new Error(`only ${data.elements?.length ?? 0} elements, expected at least ${MIN_ELEMENTS}`);
  }
  return data;
}

for (const endpoint of ENDPOINTS) {
  try {
    console.log(`Querying ${endpoint} ...`);
    const data = await query(endpoint);
    mkdirSync('data/raw', { recursive: true });
    writeFileSync(OUTPUT, JSON.stringify(data));
    console.log(`Wrote ${data.elements!.length} elements to ${OUTPUT}`);
    process.exit(0);
  } catch (error) {
    console.warn(`  failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.error('Every Overpass endpoint failed. Try again later.');
process.exit(1);
