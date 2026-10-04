/**
 * Turns data/raw/overpass.json into the compact data the app ships in
 * public/data/. Run `npm run data:osm` first.
 *
 * Usage: npm run data:build
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import osmtogeojson from 'osmtogeojson';
import { type Bbox, bboxContains, geometryBbox, geometryCenter, pointInGeometry } from '../src/domain/geo';
import type { Institute, LngLat } from '../src/domain/types';
import { poiCategory } from '../src/features/pois/categories';
import { buildingProperties, poiProperties, roundGeometry, type OsmTags } from './lib/normalize';

const RAW = 'data/raw/overpass.json';
const INSTITUTE_OVERLAY = 'data/overlay/institutes.json';
const OUT_DIR = 'public/data';

/** The university itself: an area, but not an institute within the campus. */
const USP_RELATION = 'relation/20199272';
const INSTITUTE_AMENITIES = new Set(['college', 'research_institute', 'hospital']);

/** osmtogeojson flattens OSM tags into the properties, next to an `id` such as `way/123`. */
type OsmProperties = OsmTags & { id: string };
type OsmFeature = Feature<Geometry, OsmProperties>;
type Area = { id: string; geometry: Geometry; bbox: Bbox; size: number };

const isArea = (geometry: Geometry) => geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

function toArea(feature: OsmFeature): Area | undefined {
  const bbox = geometryBbox(feature.geometry);
  if (!bbox || !isArea(feature.geometry)) return undefined;
  return { id: feature.properties.id, geometry: feature.geometry, bbox, size: (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) };
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

const raw: unknown = JSON.parse(readFileSync(RAW, 'utf8'));
const osm = (osmtogeojson(raw) as FeatureCollection as FeatureCollection<Geometry, OsmProperties>).features;
const siglas = JSON.parse(readFileSync(INSTITUTE_OVERLAY, 'utf8')) as Record<string, { sigla?: string; name?: string }>;

// Institutes: named college / research / hospital objects that are not themselves a building.
const instituteFeatures = osm.filter(
  ({ properties }) =>
    INSTITUTE_AMENITIES.has(properties.amenity ?? '')
    && properties.name
    && !properties.building
    && properties.id !== USP_RELATION,
);
const instituteIds = new Set(instituteFeatures.map((feature) => feature.properties.id));
const instituteAreas = instituteFeatures.map(toArea).filter((area) => area !== undefined);
const institutes = instituteFeatures
  .map(({ properties, geometry }): Institute => {
    const center = geometryCenter(geometry)!;
    const sigla = siglas[properties.id]?.sigla ?? properties.short_name?.trim();
    return {
      id: properties.id,
      name: siglas[properties.id]?.name ?? properties.name!.trim(),
      ...(sigla && { sigla }),
      center: [round6(center[0]), round6(center[1])],
    };
  })
  .sort(byId);

for (const id of Object.keys(siglas)) {
  if (!instituteIds.has(id)) console.warn(`  warning: ${INSTITUTE_OVERLAY} refers to ${id}, which is not an institute in the OSM data`);
}

const buildingFeatures = osm.filter(({ properties, geometry }) => properties.building && isArea(geometry));
const buildingAreas = buildingFeatures.map(toArea).filter((area) => area !== undefined);
const buildings = buildingFeatures.map(({ properties, geometry }): Feature => ({
  type: 'Feature',
  properties: buildingProperties(properties.id, properties, containingArea(geometryCenter(geometry)!, instituteAreas)),
  geometry: roundGeometry(geometry),
}));

// POIs are stored as points; a POI mapped as an area keeps only its centre.
const pois = osm.flatMap(({ properties, geometry }): Feature[] => {
  const category = poiCategory(properties);
  const center = geometryCenter(geometry);
  if (!category || !center || instituteIds.has(properties.id)) return [];
  const building = properties.building ? properties.id : containingArea(center, buildingAreas);
  return [{
    type: 'Feature',
    properties: poiProperties(properties.id, properties, category, building),
    geometry: { type: 'Point', coordinates: [round6(center[0]), round6(center[1])] },
  }];
});

mkdirSync(OUT_DIR, { recursive: true });
writeFeatures('buildings.geojson', buildings);
writeFeatures('pois.geojson', pois);
writeJson('institutes.json', institutes, institutes.length);
