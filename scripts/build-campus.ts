/**
 * Turns data/raw/overpass.json plus the hand-curated overlay into the compact
 * data the app ships in public/data/. Run `npm run data:osm` first.
 *
 * Usage: npm run data:build
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import osmtogeojson from 'osmtogeojson';
import { type Bbox, bboxContains, geometryBbox, geometryCenter, pointInGeometry } from '../src/domain/geo';
import { ROOF_UNIT_METERS, type RoofEntry } from '../src/domain/roofs';
import { encodeTrees, type Tree } from '../src/domain/trees';
import type { Institute, LngLat } from '../src/domain/types';
import { poiCategory } from '../src/features/pois/categories';
import { classifyAccessFeature } from './lib/accessibility';
import { formatAddress, type NamedRoad, nearestRoad, type NominatimAddress, website, wikiRef } from './lib/address';
import { type CampusRecord, mergeOverlay, type OverlayFeature } from './lib/mergeOverlay';
import { buildIndoorPlan, type IndoorSource, type IndoorWalls } from './lib/indoor/plan';
import { buildLandmark, type Landmark } from './lib/landmarks';
import { buildRoof, LANTERN_METERS, type RoofOverlay, roofSpec, roofTop, standsOnTop, type Xy } from './lib/roofs';
import {
  areaSquareMeters,
  circlePolygon,
  clumpNoise,
  isStreetRow,
  keepSome,
  projector,
  SegmentIndex,
  streetLineTrees,
} from './lib/treePlacement';
import { alongLine, scatterInPolygon, selectTrees, treeAt, unitHash } from './lib/trees';
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
/** Written by `npm run data:addresses`. Without it the buildings only get the addresses tagged in OSM. */
const ADDRESSES = 'data/raw/addresses.json';
const OUT_DIR = 'public/data';

/** The university itself: an area, but not an institute within the campus. */
const USP_RELATION = 'relation/20199272';
const INSTITUTE_AMENITIES = new Set(['college', 'research_institute', 'hospital']);

/** Same point as the app's CAMPUS_CENTER; tree positions are stored relative to it. */
const TREE_ORIGIN: LngLat = [-46.7283, -23.5611];
/** How many trees to ship. The 3D tree layer can draw up to 4,000; fewer reads better and the woods take up the slack. */
const MAX_TREES = 1000;
const WOOD_SPACING_METERS = 12;
const ROW_SPACING_METERS = 9;
/**
 * How the trees share the budget. The grid in a wood is much denser than what
 * can be shipped, so a wood keeps the smallest share of its grid points; woods
 * named in the tree overlay keep 4 times that; lawns, named grounds and mapped
 * rows, which are sparse to begin with, 15 times; and individually mapped
 * trees, the only ones that are really there, 34 times.
 */
const PRIORITY_WOOD_WEIGHT = 4;
const OPEN_GROUND_WEIGHT = 15;
const MAPPED_TREE_WEIGHT = 34;
/** Hand-picked grounds to plant, beyond what OSM maps as green. */
const TREE_AREAS = 'data/overlay/tree-areas.json';
/** Roofs of landmark buildings, by building id. OSM roof tags are read too; this file wins. */
const ROOFS = 'data/overlay/roofs.json';
/** Floor plans, one folder per building: `source.json` by hand, `walls.json` from `npm run indoor:extract`. */
const INDOOR = 'data/indoor';
/** Monuments drawn in 3D on a POI, as stacked blocks. */
const LANDMARKS = 'data/overlay/landmarks.json';
/** A mapped row within this distance of a street is a street row; of those, one tree in five is kept. */
const STREET_ROW_METERS = 15;
const STREET_TREE_METERS = 12;
const STREET_LINE_NEIGHBOUR_METERS = 25;
const STREET_KEEP_ONE_IN = 5;
/** Parks, gardens and grass: sparser than woods, and only areas large enough to hold a few trees. */
const LAWN_SPACING_METERS = 14;
const LAWN_MIN_SQUARE_METERS = 1500;
const GROUNDS_SPACING_METERS = 11;
/** Share of grid points planted where the clump noise is lowest; it rises to all of them where it is highest. */
const LAWN_MIN_COVER = 0.35;
const CLUMP_SCALE_METERS = 70;
/** Distance a generated tree keeps from a building wall and from the centre line of roads and paths. */
const BUILDING_CLEARANCE_METERS = 4;
const STREET_CLEARANCE_METERS = 8;
const SERVICE_CLEARANCE_METERS = 5;
const PATH_CLEARANCE_METERS = 2.5;
const LAWN_LANDUSE = new Set(['grass', 'meadow', 'recreation_ground', 'village_green']);
const LAWN_NATURAL = new Set(['scrub', 'grassland']);
const NO_TREE_LEISURE = new Set(['pitch', 'track', 'swimming_pool', 'stadium', 'sports_centre', 'playground']);

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
    const wiki = wikiRef(tags);
    const web = website(tags);
    return {
      id,
      name: siglas[id]?.name ?? tags.name!.trim(),
      ...(sigla && { sigla }),
      center: [round6(center[0]), round6(center[1])],
      ...(wiki && { wiki }),
      ...(web && { website: web }),
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

const addresses: Record<string, NominatimAddress | null> = existsSync(ADDRESSES)
  ? (JSON.parse(readFileSync(ADDRESSES, 'utf8')) as Record<string, NominatimAddress | null>)
  : {};
if (!existsSync(ADDRESSES)) console.warn(`  warning: ${ADDRESSES} not found; run npm run data:addresses to add street addresses`);

/** A building further than this from every named street gets no street. */
const ROAD_MAX_METERS = 150;
/** Streets a building can have as its address: not footways, steps or cycle paths. */
const ADDRESS_HIGHWAYS = /^(primary|secondary|tertiary|residential|unclassified|service|living_street)(_link)?$/;
const roads = records.flatMap(({ tags, geometry }): NamedRoad[] =>
  tags.name && ADDRESS_HIGHWAYS.test(tags.highway ?? '') && geometry.type === 'LineString'
    ? [{ name: tags.name.trim(), line: geometry.coordinates as LngLat[] }]
    : [],
);
if (roads.length === 0) console.warn('  warning: no named streets in the OSM data; run npm run data:osm');

const buildingRecords = records.filter(({ tags, geometry }) => tags.building && isArea(geometry));
const buildingAreas = buildingRecords.map(toArea).filter((area) => area !== undefined);
const buildings = buildingRecords.map((record): Feature => ({
  type: 'Feature',
  properties: buildingProperties(record.id, record.tags, {
    institute: resolveInstitute(record) ?? containingArea(geometryCenter(record.geometry)!, instituteAreas),
    source: sourceOf(record),
    address: formatAddress(
      record.tags,
      addresses[record.id] ?? undefined,
      nearestRoad(geometryCenter(record.geometry)!, roads, ROAD_MAX_METERS),
    ),
  }),
  geometry: roundGeometry(record.geometry),
}));
if (unknownInstitutes.length > 0) {
  fail(`${OVERLAY} names institutes that do not exist (use a sigla or an id from institutes.json):`, unknownInstitutes);
}

// --- Roofs -----------------------------------------------------------------

const DEFAULT_ROOF_COLOUR = '#b4b9bd';
/** A roof never takes more than this share of its building's height; a taller roof stands above it. */
const ROOF_MAX_SHARE = 0.6;

const roofOverlay = JSON.parse(readFileSync(ROOFS, 'utf8')) as Record<string, RoofOverlay>;
const unknownRoofs = Object.keys(roofOverlay).filter((id) => !buildingRecords.some((record) => record.id === id));
if (unknownRoofs.length > 0) fail(`${ROOFS} names buildings that do not exist:`, unknownRoofs);

const roofs: RoofEntry[] = [];
buildingRecords.forEach((record, index) => {
  const spec = roofSpec(record.tags, roofOverlay[record.id]);
  const { geometry } = record;
  if (!spec || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return;
  const at = geometryCenter(geometry)!;
  const toMeters = projector(at);
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const triangles = polygons.flatMap((rings) => buildRoof(rings.map((ring) => ring.map((point): Xy => toMeters(point))), spec));
  if (triangles.length === 0) return;

  const properties = buildings[index]!.properties as { h: number; mh: number; acc: RoofEntry['acc']; eh?: number };
  const walls = properties.h - properties.mh;
  // A lantern rises above the building's height; the rest of the roof is taken out of the walls.
  const onTop = standsOnTop(spec);
  const base = onTop ? properties.h : Math.round((properties.h - Math.min(roofTop(triangles) - (spec.lantern ? LANTERN_METERS : 0), walls * ROOF_MAX_SHARE)) * 10) / 10;
  if (!onTop) properties.eh = base;
  roofs.push({
    id: record.id,
    at: [Number(at[0].toFixed(6)), Number(at[1].toFixed(6))],
    base,
    c: spec.colour ?? DEFAULT_ROOF_COLOUR,
    acc: properties.acc,
    p: triangles.map((value) => Math.round(value / ROOF_UNIT_METERS)),
  });
});

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

// --- Trees -------------------------------------------------------------------
// Street rows are thinned, and trees are generated in woods, lawns and the
// grounds listed in the tree overlay. Nothing here is shipped except trees.json.

const toXy = projector(TREE_ORIGIN);
const lineOf = (coordinates: unknown) => (coordinates as LngLat[]).map(toXy);

/** Streets and service roads: what a "street tree" stands beside. */
const streets = new SegmentIndex();
const carriageways = new SegmentIndex();
const serviceRoads = new SegmentIndex();
const paths = new SegmentIndex();
for (const { tags, geometry } of records) {
  if (!tags.highway || geometry.type !== 'LineString') continue;
  const line = lineOf(geometry.coordinates);
  if (ADDRESS_HIGHWAYS.test(tags.highway) || tags.highway === 'busway') {
    streets.addLine(line);
    (tags.highway === 'service' ? serviceRoads : carriageways).addLine(line);
  } else {
    paths.addLine(line);
  }
}
const walls = new SegmentIndex();
for (const { geometry } of buildingRecords) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  for (const rings of polygons) for (const ring of rings) walls.addLine(lineOf(ring));
}
/** Ground a tree cannot grow on: parking, sports grounds and water. */
const noTreeAreas = records
  .filter(
    ({ tags, geometry }) =>
      isArea(geometry)
      && (tags.amenity === 'parking'
        || NO_TREE_LEISURE.has(tags.leisure ?? '')
        || tags.natural === 'water'
        || tags.natural === 'sand'
        || tags.landuse === 'basin'),
  )
  .map(toArea)
  .filter((area) => area !== undefined);

const insideBuilding = (point: LngLat) => containingArea(point, buildingAreas) !== undefined;
/** No generated tree on a building or hard against it, on a road or path, or on ground that has another use. */
const blocked = (point: LngLat) => {
  const xy = toXy(point);
  return (
    insideBuilding(point)
    || walls.within(xy, BUILDING_CLEARANCE_METERS)
    || carriageways.within(xy, STREET_CLEARANCE_METERS)
    || serviceRoads.within(xy, SERVICE_CLEARANCE_METERS)
    || paths.within(xy, PATH_CLEARANCE_METERS)
    || containingArea(point, noTreeAreas) !== undefined
  );
};
/** Lawns keep clearings: the denser the noise at a point, the likelier a tree. */
const inClump = (point: LngLat) => {
  const xy = toXy(point);
  return unitHash(Math.round(xy[0] * 10), Math.round(xy[1] * 10), 8) < LAWN_MIN_COVER + (1 - LAWN_MIN_COVER) * clumpNoise(xy, CLUMP_SCALE_METERS);
};

// Mapped trees and rows: thinned where they line a street, kept elsewhere.
const mappedPositions = records.flatMap(({ tags, geometry }) =>
  tags.natural === 'tree' && geometry.type === 'Point' ? [geometry.coordinates as LngLat] : [],
);
const inStreetLine = streetLineTrees(mappedPositions.map(toXy), (xy) => streets.within(xy, STREET_TREE_METERS), STREET_LINE_NEIGHBOUR_METERS);
const mappedTrees = mappedPositions
  .filter((position, index) => !inStreetLine[index] || keepSome(toXy(position), STREET_KEEP_ONE_IN))
  .map((position) => treeAt(position, 7, 13));

const rowTrees: Tree[] = [];
let streetRows = 0;
let rowCandidates = 0;
for (const { tags, geometry } of records) {
  if (tags.natural !== 'tree_row' || geometry.type !== 'LineString') continue;
  const points = alongLine(geometry.coordinates as LngLat[], ROW_SPACING_METERS);
  rowCandidates += points.length;
  const street = isStreetRow(points.map(toXy), (xy) => streets.within(xy, STREET_ROW_METERS));
  if (street) streetRows += 1;
  for (const point of points) {
    if (!street || keepSome(toXy(point), STREET_KEEP_ONE_IN)) rowTrees.push(treeAt(point, 7, 12));
  }
}

// Generated trees. An area filled by an earlier, denser kind is not filled again.
const filled: Area[] = [];
const alreadyFilled = (point: LngLat) => containingArea(point, filled) !== undefined;
const isWood = (tags: OsmTags) => tags.natural === 'wood' || tags.landuse === 'forest';
const isLawn = (tags: OsmTags) =>
  tags.leisure === 'park' || tags.leisure === 'garden' || LAWN_LANDUSE.has(tags.landuse ?? '') || LAWN_NATURAL.has(tags.natural ?? '');

type TreeAreas = {
  /** Institutes whose grounds are planted, by sigla or id, optionally with their own spacing in metres. */
  institutes: { institute: string; spacing?: number }[];
  /** Circles around an OSM object, for places that have no area of their own. */
  around: { name: string; id: string; radius: number; spacing?: number }[];
  /** Woods (OSM ids) that stay dense when the tree budget forces thinning. */
  priorityWoods: string[];
};
const treeAreas = JSON.parse(readFileSync(TREE_AREAS, 'utf8')) as TreeAreas;
const unknownGrounds = treeAreas.priorityWoods
  .filter((id) => !records.some((record) => record.id === id && isWood(record.tags)))
  .map((id) => `priority wood ${id} is not a wood in the OSM data`);

const woodTrees: Tree[] = [];
const priorityWoodTrees = new Set<Tree>();
for (const record of records) {
  if (!isWood(record.tags) || !isArea(record.geometry)) continue;
  const priority = treeAreas.priorityWoods.includes(record.id);
  for (const point of scatterInPolygon(record.geometry, WOOD_SPACING_METERS, blocked)) {
    const tree = treeAt(point, 9, 17);
    woodTrees.push(tree);
    if (priority) priorityWoodTrees.add(tree);
  }
}
for (const record of records) if (isWood(record.tags)) filled.push(...[toArea(record)].filter((area) => area !== undefined));

const lawnTrees: Tree[] = [];
const lawnCounts: string[] = [];
const lawns = records.filter(
  (record) => isLawn(record.tags) && isArea(record.geometry) && areaSquareMeters(record.geometry, toXy) >= LAWN_MIN_SQUARE_METERS,
);
for (const record of lawns) {
  const points = scatterInPolygon(record.geometry, LAWN_SPACING_METERS, (point) => blocked(point) || alreadyFilled(point) || !inClump(point));
  for (const point of points) lawnTrees.push(treeAt(point, 6, 12));
  if (record.tags.name) lawnCounts.push(`${record.tags.name} ${points.length}`);
}
for (const record of lawns) filled.push(...[toArea(record)].filter((area) => area !== undefined));

// Grounds named in the overlay: institute areas and circles around a building.
const grounds: { name: string; geometry: Geometry; spacing: number }[] = [];
for (const { institute: wanted, spacing = GROUNDS_SPACING_METERS } of treeAreas.institutes) {
  const institute = institutes.find((candidate) => candidate.id === wanted || candidate.sigla === wanted);
  const record = institute && instituteRecords.find((candidate) => candidate.id === institute.id);
  if (record && isArea(record.geometry)) grounds.push({ name: wanted, geometry: record.geometry, spacing });
  else unknownGrounds.push(`institute "${wanted}" (needs the sigla or id of an institute that is an area)`);
}
for (const { name, id, radius, spacing = GROUNDS_SPACING_METERS } of treeAreas.around) {
  const record = records.find((candidate) => candidate.id === id);
  const center = record && geometryCenter(record.geometry);
  if (center) grounds.push({ name, geometry: circlePolygon(center, radius), spacing });
  else unknownGrounds.push(`"${name}": ${id} is not in the OSM data`);
}
if (unknownGrounds.length > 0) fail(`${TREE_AREAS} names areas that cannot be used:`, unknownGrounds);

const groundTrees: Tree[] = [];
const groundCounts: string[] = [];
for (const { name, geometry, spacing } of grounds) {
  const points = scatterInPolygon(geometry, spacing, (point) => blocked(point) || alreadyFilled(point) || !inClump(point));
  for (const point of points) groundTrees.push(treeAt(point, 6, 13));
  groundCounts.push(`${name} ${points.length}`);
  const bbox = geometryBbox(geometry)!;
  // Two grounds may overlap (a circle and an institute).
  filled.push({ id: name, geometry, bbox, size: (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) });
}

// Every kind of tree is thinned evenly to fit the budget, each by its weight.
const mappedSet = new Set(mappedTrees);
const openGroundTrees = new Set([...rowTrees, ...groundTrees, ...lawnTrees]);
const trees = selectTrees([], [...mappedTrees, ...rowTrees, ...groundTrees, ...lawnTrees, ...woodTrees], MAX_TREES, (tree) =>
  mappedSet.has(tree)
    ? MAPPED_TREE_WEIGHT
    : openGroundTrees.has(tree)
      ? OPEN_GROUND_WEIGHT
      : priorityWoodTrees.has(tree)
        ? PRIORITY_WOOD_WEIGHT
        : 1,
);
const keptTrees = new Set(trees);
const keptOf = (group: Iterable<Tree>) => [...group].filter((tree) => keptTrees.has(tree)).length;

// --- Write and report ------------------------------------------------------

mkdirSync(`${OUT_DIR}/indoor`, { recursive: true });
// Indoor plans: one file per building, and the building says which file is its own.
const indoorPlans = existsSync(INDOOR) ? readdirSync(INDOOR).filter((folder) => existsSync(`${INDOOR}/${folder}/source.json`)) : [];
for (const folder of indoorPlans) {
  const read = (name: string) => JSON.parse(readFileSync(`${INDOOR}/${folder}/${name}`, 'utf8')) as unknown;
  const plan = buildIndoorPlan(read('source.json') as IndoorSource, read('walls.json') as IndoorWalls);
  const building = buildings.find((candidate) => candidate.properties!.id === plan.building);
  if (!building) fail(`${INDOOR}/${folder} is for a building that does not exist:`, [plan.building]);
  building.properties!.indoor = folder;
  writeJson(`indoor/${folder}.json`, plan, plan.levels.length);
}
writeFeatures('buildings.geojson', buildings);
writeFeatures('pois.geojson', pois);
writeFeatures('accessibility.geojson', accessFeatures);
writeJson('institutes.json', institutes, institutes.length);
writeJson('trees.json', encodeTrees(trees, TREE_ORIGIN), trees.length);
// Monuments ride in the same file as the roofs: both are coloured triangles at a position.
const landmarks = JSON.parse(readFileSync(LANDMARKS, 'utf8')) as Landmark[];
const unknownLandmarks = landmarks.filter(({ id }) => !pois.some((poi) => poi.properties!.id === id)).map(({ id }) => id);
if (unknownLandmarks.length > 0) fail(`${LANDMARKS} names places that are not on the map:`, unknownLandmarks);
for (const landmark of landmarks) {
  const poi = pois.find((candidate) => candidate.properties!.id === landmark.id)!;
  const at = geometryCenter(poi.geometry)!;
  for (const [colour, triangles] of buildLandmark(landmark)) {
    roofs.push({ id: landmark.id, at, base: 0, c: colour, acc: poi.properties!.acc as RoofEntry['acc'], p: triangles.map((value) => Math.round(value / ROOF_UNIT_METERS)) });
  }
}
writeJson('roofs.json', { roofs }, roofs.length);

const count = (features: Feature[], test: (properties: Record<string, unknown>) => unknown) =>
  features.filter((feature) => test(feature.properties!)).length;
const byKind = new Map<string, number>();
for (const feature of accessFeatures) {
  const kind = String(feature.properties!.kind);
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
}

console.log('\nCoverage');
console.log(`  buildings with a name:            ${percent(count(buildings, (p) => p.name), buildings.length)}`);
console.log(`  buildings with an address:        ${percent(count(buildings, (p) => p.addr), buildings.length)}`);
console.log(`  with a Wikipedia article:         ${count(buildings, (p) => p.wiki)} buildings, ${institutes.filter((institute) => institute.wiki).length} institutes, ${count(pois, (p) => p.wiki)} places`);
console.log(`  buildings with an institute:      ${percent(count(buildings, (p) => p.inst), buildings.length)}`);
console.log(`  buildings with known access:      ${percent(count(buildings, (p) => p.acc !== 'u'), buildings.length)}`);
console.log(`  objects changed by the overlay:   ${records.filter((record) => record.curated).length}`);
console.log(`  trees kept:                       ${trees.length} (max ${MAX_TREES})`);
console.log(`    mapped:                         ${keptOf(mappedTrees)} of ${mappedPositions.length} (${inStreetLine.filter(Boolean).length} in street lines, thinned)`);
console.log(`    rows:                           ${keptOf(rowTrees)} of ${rowCandidates} (${streetRows} street rows, thinned)`);
console.log(`    named grounds:                  ${keptOf(groundTrees)} of ${groundTrees.length} (before thinning: ${groundCounts.join(', ')})`);
console.log(`    parks, gardens and grass:       ${keptOf(lawnTrees)} of ${lawnTrees.length} in ${lawns.length} areas (before thinning: ${lawnCounts.join(', ')})`);
console.log(`    woods:                          ${keptOf(woodTrees)} of ${woodTrees.length} (${keptOf(priorityWoodTrees)} of ${priorityWoodTrees.size} in priority woods)`);
console.log(`  roofs:                            ${roofs.length} entries (${Object.keys(roofOverlay).length} roofs from the overlay, ${landmarks.length} monuments)`);
console.log(`  indoor plans:                     ${indoorPlans.join(', ') || 'none'}`);
console.log(`  accessibility features:           ${[...byKind].map(([kind, n]) => `${kind} ${n}`).join(', ') || 'none'}`);
