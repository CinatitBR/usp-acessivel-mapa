/**
 * Turns data/raw/overpass.json plus the hand-curated overlay into the compact
 * data the app ships in public/data/. Run `npm run data:osm` first.
 *
 * Usage: npm run data:build
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import osmtogeojson from 'osmtogeojson';
import { type Bbox, bboxContains, geometryBbox, geometryCenter, pointInGeometry } from '../src/domain/geo';
import type { Institute, LngLat } from '../src/domain/types';
import { poiCategory } from '../src/features/pois/categories';
import { classifyAccessFeature } from './lib/accessibility';
import { type CampusRecord, mergeOverlay, type OverlayFeature } from './lib/mergeOverlay';
import {
  accessFeatureProperties,
  buildingProperties,
  poiProperties,
  roundGeometry,
  type OsmTags,
} from './lib/normalize';

const RAW = 'data/raw/overpass.json';
const OVERLAY = 'data/overlay/campus-overlay.geojson';
const INSTITUTE_OVERLAY = 'data/overlay/institutes.json';
const OUT_DIR = 'public/data';

/** The university itself: an area, but not an institute within the campus. */
const USP_RELATION = 'relation/20199272';
const INSTITUTE_AMENITIES = new Set(['college', 'research_institute', 'hospital']);

type RawElement = { type: string; id: number; tags?: OsmTags; nodes?: number[] };
type Area = { id: string; geometry: Geometry; bbox: Bbox; size: number };

const isArea = (geometry: Geometry) => geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const percent = (part: number, total: number) => `${part}/${total} (${total ? Math.round((part / total) * 100) : 0}%)`;
const sourceOf = (record: CampusRecord) => (record.curated ? 'curated' : 'osm');
const pointGeometry = ([lng, lat]: LngLat): Geometry => ({ type: 'Point', coordinates: [round6(lng), round6(lat)] });

function fail(message: string, details: string[]): never {
  console.error(`\n${message}`);
  for (const detail of details) console.error(`  - ${detail}`);
  process.exit(1);
}

function toArea(record: CampusRecord): Area | undefined {
  const bbox = geometryBbox(record.geometry);
  if (!bbox || !isArea(record.geometry)) return undefined;
  return { id: record.id, geometry: record.geometry, bbox, size: (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) };
}

/** Smallest area containing the point, so nested areas resolve to the most specific one. */
function containingArea(point: LngLat, areas: Area[]): string | undefined {
  return areas
    .filter((area) => bboxContains(area.bbox, point) && pointInGeometry(point, area.geometry))
    .sort((a, b) => a.size - b.size)[0]?.id;
}

function writeJson(name: string, value: unknown, count: number) {
  const json = JSON.stringify(value);
  writeFileSync(`${OUT_DIR}/${name}`, json);
  console.log(`${name}: ${count} entries, ${(json.length / 1024).toFixed(0)} KB`);
}

function writeFeatures(name: string, features: Feature[]) {
  // Stable order keeps git diffs small when the data is refreshed.
  features.sort((a, b) => String(a.properties!.id).localeCompare(String(b.properties!.id)));
  writeJson(name, { type: 'FeatureCollection', features } satisfies FeatureCollection, features.length);
}

// --- Load OSM and apply the overlay ---------------------------------------

const raw = JSON.parse(readFileSync(RAW, 'utf8')) as { elements: RawElement[] };
const osmRecords = (osmtogeojson(raw) as FeatureCollection).features.map((feature): CampusRecord => {
  // osmtogeojson flattens the tags into the properties, next to an `id` such as `way/123`.
  // OSM's own `note` is a remark between mappers, not something to show users.
  const { id, note: _mapperNote, ...tags } = feature.properties as OsmTags & { id: string };
  return { id, tags, geometry: feature.geometry };
});

const overlay = JSON.parse(readFileSync(OVERLAY, 'utf8')) as { features: OverlayFeature[] };
const { records, unmatched, invalid } = mergeOverlay(osmRecords, overlay.features);
if (unmatched.length > 0) {
  fail(`${OVERLAY} refers to OSM objects that are not in the downloaded data:`, unmatched);
}
if (invalid.length > 0) fail(`${OVERLAY} has features that cannot be used:`, invalid);

// --- Institutes ------------------------------------------------------------

const siglas = JSON.parse(readFileSync(INSTITUTE_OVERLAY, 'utf8')) as Record<string, { sigla?: string; name?: string }>;

// Named college / research / hospital objects that are not themselves a building.
const instituteRecords = records.filter(
  ({ id, tags }) => INSTITUTE_AMENITIES.has(tags.amenity ?? '') && tags.name && !tags.building && id !== USP_RELATION,
);
const instituteIds = new Set(instituteRecords.map((record) => record.id));
const instituteAreas = instituteRecords.map(toArea).filter((area) => area !== undefined);
const institutes = instituteRecords
  .map(({ id, tags, geometry }): Institute => {
    const center = geometryCenter(geometry)!;
    const sigla = siglas[id]?.sigla ?? tags.short_name?.trim();
    return {
      id,
      name: siglas[id]?.name ?? tags.name!.trim(),
      ...(sigla && { sigla }),
      center: [round6(center[0]), round6(center[1])],
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

for (const id of Object.keys(siglas)) {
  if (!instituteIds.has(id)) console.warn(`  warning: ${INSTITUTE_OVERLAY} refers to ${id}, which is not an institute in the OSM data`);
}

/** The overlay may name an institute by its sigla (as shown in the app) or by its id. */
const unknownInstitutes: string[] = [];
function resolveInstitute(record: CampusRecord): string | undefined {
  const wanted = record.tags.institute;
  if (!wanted) return undefined;
  const match = institutes.find(
    (institute) => institute.id === wanted || institute.sigla?.toLowerCase() === wanted.toLowerCase(),
  );
  if (!match) unknownInstitutes.push(`${record.id}: "${wanted}"`);
  return match?.id;
}

// --- Buildings -------------------------------------------------------------

const buildingRecords = records.filter(({ tags, geometry }) => tags.building && isArea(geometry));
const buildingAreas = buildingRecords.map(toArea).filter((area) => area !== undefined);
const buildings = buildingRecords.map((record): Feature => ({
  type: 'Feature',
  properties: buildingProperties(record.id, record.tags, {
    institute: resolveInstitute(record) ?? containingArea(geometryCenter(record.geometry)!, instituteAreas),
    source: sourceOf(record),
  }),
  geometry: roundGeometry(record.geometry),
}));
if (unknownInstitutes.length > 0) {
  fail(`${OVERLAY} names institutes that do not exist (use a sigla or an id from institutes.json):`, unknownInstitutes);
}

// An entrance is a node on its building's outline, where point-in-polygon is unreliable.
const buildingOfNode = new Map<string, string>();
for (const element of raw.elements) {
  if (element.type !== 'way' || !element.tags?.building) continue;
  for (const node of element.nodes ?? []) buildingOfNode.set(`node/${node}`, `way/${element.id}`);
}
const buildingIds = new Set(buildingRecords.map((record) => record.id));
function buildingOf(record: CampusRecord, center: LngLat): string | undefined {
  const building = record.tags.building_id ?? buildingOfNode.get(record.id) ?? containingArea(center, buildingAreas);
  return building && buildingIds.has(building) ? building : undefined;
}

// --- POIs and accessibility features (both stored as points) ----------------

const pois: Feature[] = [];
const accessFeatures: Feature[] = [];
const unused: string[] = [];
for (const record of records) {
  const center = geometryCenter(record.geometry);
  if (!center) continue;
  const isBuilding = buildingIds.has(record.id);

  const category = instituteIds.has(record.id) ? undefined : poiCategory(record.tags);
  if (category) {
    pois.push({
      type: 'Feature',
      properties: poiProperties(record.id, record.tags, category, {
        building: isBuilding ? record.id : buildingOf(record, center),
        source: sourceOf(record),
      }),
      geometry: pointGeometry(center),
    });
  }

  const classified = isBuilding ? undefined : classifyAccessFeature(record.tags);
  if (classified) {
    accessFeatures.push({
      type: 'Feature',
      properties: accessFeatureProperties(record.id, record.tags, classified, {
        building: buildingOf(record, center),
        source: sourceOf(record),
      }),
      geometry: pointGeometry(center),
    });
  }

  if (record.id.startsWith('curated/') && !category && !classified && !isBuilding) {
    unused.push(`${record.id} at ${center.join(', ')}: needs a "kind", a "building" tag or a POI tag such as "amenity"`);
  }
}
if (unused.length > 0) fail(`${OVERLAY} adds features that would not appear anywhere:`, unused);

// --- Write and report ------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
writeFeatures('buildings.geojson', buildings);
writeFeatures('pois.geojson', pois);
writeFeatures('accessibility.geojson', accessFeatures);
writeJson('institutes.json', institutes, institutes.length);

const count = (features: Feature[], test: (properties: Record<string, unknown>) => unknown) =>
  features.filter((feature) => test(feature.properties!)).length;
const byKind = new Map<string, number>();
for (const feature of accessFeatures) {
  const kind = String(feature.properties!.kind);
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
}

console.log('\nCoverage');
console.log(`  buildings with a name:            ${percent(count(buildings, (p) => p.name), buildings.length)}`);
console.log(`  buildings with an institute:      ${percent(count(buildings, (p) => p.inst), buildings.length)}`);
console.log(`  buildings with known access:      ${percent(count(buildings, (p) => p.acc !== 'u'), buildings.length)}`);
console.log(`  objects changed by the overlay:   ${records.filter((record) => record.curated).length}`);
console.log(`  accessibility features:           ${[...byKind].map(([kind, n]) => `${kind} ${n}`).join(', ') || 'none'}`);
