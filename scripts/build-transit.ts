/**
 * Builds public/data/stops.geojson and lines.geojson from the SPTrans GTFS.
 *
 * - Lines in FULL_LINES get their route shape (and, with a token, their Olho
 *   Vivo codes for live positions).
 * - Stops are every stop inside the campus plus every stop of those lines.
 *   Each stop lists all lines that call there, whatever their tier.
 *
 * Usage: npm run data:transit            (reuses data/raw/gtfs.zip if present)
 *        npm run data:transit -- --refresh   (downloads the GTFS again)
 * Needs data/raw/overpass.json (npm run data:osm) for the campus boundary.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import osmtogeojson from 'osmtogeojson';
import { deriveAccessStatus, encodeAccess } from '../src/domain/access';
import { type Bbox, bboxContains, geometryBbox, pointInGeometry } from '../src/domain/geo';
import type { LngLat } from '../src/domain/types';
import { buildShape } from '../src/features/transit/interpolate';
import { locateStops } from '../src/features/transit/lineStops';
import type { BusLineProperties, BusStopProperties } from '../src/features/transit/parse';
import { CAMPUS_AREA_IDS } from './lib/campus';
import { distanceMeters, parseCsv, simplifyLine } from './lib/gtfs';
import { resolveLineCodes } from './lib/olhovivoCodes';

/** Mobility Database mirror of the SPTrans feed (mdb-8): no login needed, same feed Transitous uses. */
const GTFS_URL = 'https://files.mobilitydatabase.org/mdb-8/latest.zip';
const GTFS_ZIP = 'data/raw/gtfs.zip';
const OVERPASS = 'data/raw/overpass.json';
const OUT_DIR = 'public/data';
const LINES_FILE = `${OUT_DIR}/lines.geojson`;

/** Lines drawn on the map and tracked live, with their map colour. Change this list when SPTrans changes the circulars. */
const FULL_LINES: Record<string, string> = {
  '8082-10': '#d9480f',
  '8083-10': '#1971c2',
  '8084-10': '#2f9e44',
  '8085-10': '#9c36b5',
  '8012-10': '#e03131',
  '8022-10': '#0c8599',
};

const SHAPE_TOLERANCE_METERS = 2;
/** An OSM bus stop this close to a GTFS stop is taken to be the same stop. */
const OSM_MATCH_METERS = 30;

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

async function loadGtfs(): Promise<Record<string, string>> {
  if (process.argv.includes('--refresh') || !existsSync(GTFS_ZIP)) {
    console.log(`Downloading ${GTFS_URL} ...`);
    const response = await fetch(GTFS_URL, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok) throw new Error(`GTFS download failed: HTTP ${response.status}`);
    mkdirSync('data/raw', { recursive: true });
    writeFileSync(GTFS_ZIP, Buffer.from(await response.arrayBuffer()));
  }
  const wanted = new Set(['routes.txt', 'trips.txt', 'stops.txt', 'stop_times.txt', 'shapes.txt']);
  const files = unzipSync(new Uint8Array(readFileSync(GTFS_ZIP)), { filter: (file) => wanted.has(file.name) });
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, strFromU8(bytes)]));
}

function writeFeatures(name: string, features: Feature[]) {
  const json = JSON.stringify({ type: 'FeatureCollection', features } satisfies FeatureCollection);
  writeFileSync(`${OUT_DIR}/${name}`, json);
  console.log(`${name}: ${features.length} entries, ${(json.length / 1024).toFixed(0)} KB`);
}

// --- Campus boundary and OSM bus stops --------------------------------------

const osm = (osmtogeojson(JSON.parse(readFileSync(OVERPASS, 'utf8'))) as FeatureCollection<Geometry, Record<string, string>>).features;
const campusAreas = osm
  .filter((feature) => CAMPUS_AREA_IDS.has(feature.properties.id!))
  .map((feature) => ({ geometry: feature.geometry, bbox: geometryBbox(feature.geometry) as Bbox }));
if (campusAreas.length !== CAMPUS_AREA_IDS.size) throw new Error(`Campus boundary incomplete in ${OVERPASS}; run npm run data:osm`);
const inCampus = (point: LngLat) =>
  campusAreas.some((area) => bboxContains(area.bbox, point) && pointInGeometry(point, area.geometry));

const osmStops = osm.flatMap((feature) =>
  feature.properties.highway === 'bus_stop' && feature.geometry.type === 'Point'
    ? [{ position: feature.geometry.coordinates as LngLat, tags: feature.properties }]
    : [],
);

// --- GTFS -------------------------------------------------------------------

const gtfs = await loadGtfs();
const routes = new Map(parseCsv(gtfs['routes.txt']!).map((route) => [route.route_id!, route]));
const trips = parseCsv(gtfs['trips.txt']!);
const routeOfTrip = new Map(trips.map((trip) => [trip.trip_id!, trip.route_id!]));

const missing = Object.keys(FULL_LINES).filter((id) => !routes.has(id));
if (missing.length > 0) throw new Error(`Lines not in the GTFS any more: ${missing.join(', ')}. Update FULL_LINES.`);

const linesAtStop = new Map<string, Set<string>>();
const fullLineStops = new Set<string>();
/** Stops of each trip of a full line, to be put in calling order. */
const tripStops = new Map<string, { sequence: number; stopId: string }[]>();
for (const stopTime of parseCsv(gtfs['stop_times.txt']!)) {
  const route = routeOfTrip.get(stopTime.trip_id!);
  if (!route) continue;
  const stopId = stopTime.stop_id!;
  if (route in FULL_LINES) {
    const calls = tripStops.get(stopTime.trip_id!) ?? [];
    calls.push({ sequence: Number(stopTime.stop_sequence), stopId });
    tripStops.set(stopTime.trip_id!, calls);
  }
  let lines = linesAtStop.get(stopId);
  if (!lines) linesAtStop.set(stopId, (lines = new Set()));
  lines.add(route);
  if (route in FULL_LINES) fullLineStops.add(stopId);
}

// --- Stops ------------------------------------------------------------------

const stops = parseCsv(gtfs['stops.txt']!).flatMap((stop): Feature[] => {
  const id = stop.stop_id!;
  const position: LngLat = [round6(Number(stop.stop_lon)), round6(Number(stop.stop_lat))];
  const lines = linesAtStop.get(id);
  if (!lines || !(fullLineStops.has(id) || inCampus(position))) return [];

  // Shelter and wheelchair access come from the nearest OSM bus stop, when there is one.
  const nearest = osmStops
    .map((osmStop) => ({ ...osmStop, distance: distanceMeters(position, osmStop.position) }))
    .filter((osmStop) => osmStop.distance <= OSM_MATCH_METERS)
    .sort((a, b) => a.distance - b.distance)[0];
  const shelter = nearest?.tags.shelter;
  const ref = stop.stop_desc?.trim();

  const properties: BusStopProperties = {
    id,
    name: stop.stop_name!.trim(),
    ...(ref && { ref }),
    lines: [...lines].sort().join(','),
    ...((shelter === 'yes' || shelter === 'no') && { shelter: shelter === 'yes' }),
    acc: encodeAccess(deriveAccessStatus(nearest?.tags.wheelchair)),
  };
  return [{ type: 'Feature', properties, geometry: { type: 'Point', coordinates: position } }];
});
stops.sort((a, b) => String(a.properties!.id).localeCompare(String(b.properties!.id)));

// --- Lines ------------------------------------------------------------------

const fullTrips = trips.filter((trip) => trip.route_id! in FULL_LINES);
const shapeIds = new Set(fullTrips.map((trip) => trip.shape_id!));
const shapePoints = new Map<string, { sequence: number; point: LngLat }[]>();
// shapes.txt is ~60 MB: keep only the rows of the shapes we need before parsing them.
for (const row of parseCsv(gtfs['shapes.txt']!, (line) => shapeIds.has(line.slice(1, line.indexOf('"', 1))))) {
  const points = shapePoints.get(row.shape_id!) ?? [];
  points.push({ sequence: Number(row.shape_pt_sequence), point: [Number(row.shape_pt_lon), Number(row.shape_pt_lat)] });
  shapePoints.set(row.shape_id!, points);
}

/** Codes already in lines.geojson, so a run without a token does not lose them. */
function previousCodes(): Map<string, number> {
  if (!existsSync(LINES_FILE)) return new Map();
  const previous = JSON.parse(readFileSync(LINES_FILE, 'utf8')) as FeatureCollection<Geometry, BusLineProperties>;
  return new Map(
    previous.features.flatMap(({ properties }) => [
      ...(properties.code === undefined ? [] : [[`${properties.id}:${properties.dir}`, properties.code] as const]),
      ...(properties.loopCode === undefined ? [] : [[`${properties.id}:${1 - properties.dir}`, properties.loopCode] as const]),
    ]),
  );
}
const codes = (await resolveLineCodes(Object.keys(FULL_LINES))) ?? previousCodes();

const stopPositions = new Map(
  stops.flatMap((stop) => (stop.geometry.type === 'Point' ? [[String(stop.properties!.id), stop.geometry.coordinates as LngLat] as const] : [])),
);
/** Stops that sit further than this from their line's shape are reported: the timeline would place them badly. */
const STOP_OFFSET_WARN_METERS = 40;
const farStops: string[] = [];

const directionOf = (trip: (typeof fullTrips)[number]) => (Number(trip.direction_id) === 1 ? 1 : 0);
const directionKeys = new Set(fullTrips.map((trip) => `${trip.route_id}:${directionOf(trip)}`));

const lines = fullTrips.map((trip): Feature => {
  const id = trip.route_id!;
  const dir = directionOf(trip);
  const points = (shapePoints.get(trip.shape_id!) ?? []).sort((a, b) => a.sequence - b.sequence).map((entry) => entry.point);
  if (points.length < 2) throw new Error(`No shape for ${trip.trip_id}`);
  const code = codes.get(`${id}:${dir}`);
  // A loop line has one direction in the GTFS, but Olho Vivo reports its buses under two codes.
  const loopCode = directionKeys.has(`${id}:${1 - dir}`) ? undefined : codes.get(`${id}:${1 - dir}`);
  const stopIds = (tripStops.get(trip.trip_id!) ?? []).sort((a, b) => a.sequence - b.sequence).map((call) => call.stopId);
  const unknown = stopIds.filter((stopId) => !stopPositions.has(stopId));
  if (stopIds.length < 2 || unknown.length > 0) throw new Error(`Stops of ${trip.trip_id} missing from stops.geojson: ${unknown.join(', ') || 'none listed'}`);
  const properties: BusLineProperties = {
    id,
    dir,
    head: trip.trip_headsign!.trim(),
    name: routes.get(id)!.route_long_name!.trim(),
    color: FULL_LINES[id]!,
    ...(code !== undefined && { code }),
    ...(loopCode !== undefined && { loopCode }),
    stops: stopIds.join(','),
  };
  const coordinates = simplifyLine(points, SHAPE_TOLERANCE_METERS).map(([lng, lat]): LngLat => [round6(lng), round6(lat)]);
  locateStops(buildShape(coordinates), stopIds.map((stopId) => stopPositions.get(stopId)!)).forEach((located, index) => {
    if (located.offset > STOP_OFFSET_WARN_METERS) farStops.push(`${id}:${dir} ${stopIds[index]} (${Math.round(located.offset)} m)`);
  });
  return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates } };
});
lines.sort((a, b) => `${a.properties!.id}:${a.properties!.dir}`.localeCompare(`${b.properties!.id}:${b.properties!.dir}`));

// --- Write and report -------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
writeFeatures('stops.geojson', stops);
writeFeatures('lines.geojson', lines);

const otherLines = new Set(stops.flatMap((stop) => String(stop.properties!.lines).split(',')).filter((id) => !(id in FULL_LINES)));
const withCode = lines.filter((line) => line.properties!.code !== undefined).length;
console.log('\nTransit');
console.log(`  full lines:                 ${Object.keys(FULL_LINES).join(', ')}`);
console.log(`  directions with a live code: ${withCode}/${lines.length}${withCode < lines.length ? '  (set OLHOVIVO_TOKEN to resolve them)' : ''}`);
console.log(`  stops inside the campus:    ${stops.filter((stop) => stop.geometry.type === 'Point' && inCampus(stop.geometry.coordinates as LngLat)).length}`);
console.log(`  stops matched to OSM:       ${stops.filter((stop) => stop.properties!.shelter !== undefined || stop.properties!.acc !== 'u').length}`);
console.log(`  other lines at these stops: ${otherLines.size}`);
console.log(`  stops far from their shape: ${farStops.length === 0 ? 'none' : farStops.join(', ')}`);
