/**
 * Looks up the street address of every campus building on Nominatim and
 * caches the answers in data/raw/addresses.json, which build-campus.ts reads.
 * The app itself never calls Nominatim.
 *
 * Nominatim's public server allows 1 request per second and asks for a
 * descriptive User-Agent: this makes about 18 requests of 50 buildings each.
 *
 * Usage: npm run data:addresses              (only buildings not looked up yet)
 *        npm run data:addresses -- --refresh  (every building again)
 * Needs data/raw/overpass.json (npm run data:osm).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { NominatimAddress } from './lib/address';

const OVERPASS = 'data/raw/overpass.json';
const OUTPUT = 'data/raw/addresses.json';
const LOOKUP = 'https://nominatim.openstreetmap.org/lookup';
const BATCH = 50;
const PAUSE_MS = 1_100;

type RawElement = { type: string; id: number; tags?: Record<string, string> };
type LookupResult = { osm_type?: string; osm_id?: number; address?: NominatimAddress };

const raw = JSON.parse(readFileSync(OVERPASS, 'utf8')) as { elements: RawElement[] };
const buildingIds = raw.elements
  .filter((element) => element.tags?.building && (element.type === 'way' || element.type === 'relation'))
  .map((element) => `${element.type}/${element.id}`);

const refresh = process.argv.includes('--refresh');
/** `null` records a building Nominatim has no address for, so it is not asked again. */
const addresses: Record<string, NominatimAddress | null> =
  !refresh && existsSync(OUTPUT) ? (JSON.parse(readFileSync(OUTPUT, 'utf8')) as Record<string, NominatimAddress | null>) : {};

const wanted = buildingIds.filter((id) => !(id in addresses));
console.log(`${buildingIds.length} buildings, ${wanted.length} to look up`);

for (let start = 0; start < wanted.length; start += BATCH) {
  const batch = wanted.slice(start, start + BATCH);
  // Nominatim writes ids as `W123` and `R45`.
  const ids = batch.map((id) => `${id.startsWith('way/') ? 'W' : 'R'}${id.slice(id.indexOf('/') + 1)}`).join(',');
  const response = await fetch(`${LOOKUP}?osm_ids=${ids}&format=jsonv2&addressdetails=1&accept-language=pt-BR`, {
    headers: { 'User-Agent': 'usp-campus-map/0.1 (build script)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    console.error(`Nominatim answered HTTP ${response.status}; what was fetched so far is kept. Try again later.`);
    break;
  }
  const found = new Map(
    ((await response.json()) as LookupResult[]).map((result) => [`${result.osm_type}/${result.osm_id}`, result.address]),
  );
  for (const id of batch) {
    const address = found.get(id);
    addresses[id] = address
      ? {
          ...(address.road && { road: address.road }),
          ...(address.house_number && { house_number: address.house_number }),
          ...(address.postcode && { postcode: address.postcode }),
        }
      : null;
  }
  writeFileSync(OUTPUT, JSON.stringify(addresses));
  console.log(`  ${Math.min(start + BATCH, wanted.length)}/${wanted.length}`);
  if (start + BATCH < wanted.length) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

const withRoad = Object.values(addresses).filter((address) => address?.road).length;
console.log(`${OUTPUT}: ${Object.keys(addresses).length} buildings, ${withRoad} with a street`);
