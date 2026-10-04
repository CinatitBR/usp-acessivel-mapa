/**
 * Turns data/raw/overpass.json into the compact GeoJSON the app ships in
 * public/data/. Run `npm run data:osm` first.
 *
 * Usage: npm run data:build
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import osmtogeojson from 'osmtogeojson';
import { buildingProperties, roundGeometry, type OsmTags } from './lib/normalize';

const RAW = 'data/raw/overpass.json';
const OUT_DIR = 'public/data';

/** osmtogeojson flattens OSM tags into the properties, next to an `id` such as `way/123`. */
type OsmProperties = OsmTags & { id: string };

function write(name: string, features: Feature[]) {
  const collection: FeatureCollection = { type: 'FeatureCollection', features };
  const json = JSON.stringify(collection);
  writeFileSync(`${OUT_DIR}/${name}`, json);
  console.log(`${name}: ${features.length} features, ${(json.length / 1024).toFixed(0)} KB`);
}

const raw: unknown = JSON.parse(readFileSync(RAW, 'utf8'));
const osm = osmtogeojson(raw) as FeatureCollection as FeatureCollection<Geometry, OsmProperties>;

const buildings = osm.features
  .filter((feature) => {
    const type = feature.geometry.type;
    return feature.properties.building && (type === 'Polygon' || type === 'MultiPolygon');
  })
  .map((feature): Feature => ({
    type: 'Feature',
    properties: buildingProperties(feature.properties.id, feature.properties),
    geometry: roundGeometry(feature.geometry),
  }))
  // Stable order keeps git diffs small when the data is refreshed.
  .sort((a, b) => String(a.properties!.id).localeCompare(String(b.properties!.id)));

mkdirSync(OUT_DIR, { recursive: true });
write('buildings.geojson', buildings);
