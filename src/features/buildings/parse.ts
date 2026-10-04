import type { Geometry, Position } from 'geojson';
import { type AccessCode, decodeAccess } from '../../domain/access';
import type { Building, DataSource, LngLat } from '../../domain/types';

/** Property schema of public/data/buildings.geojson, written by scripts/build-campus.ts. */
export type BuildingProperties = {
  id: string;
  name?: string;
  /** Short name. */
  sn?: string;
  kind: string;
  /** Height in metres. */
  h: number;
  /** Base height in metres (above 0 for roofs and raised parts). */
  mh: number;
  acc: AccessCode;
  src: DataSource;
};

function positions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates[0] ?? [];
    case 'MultiPolygon':
      return geometry.coordinates.flatMap((polygon) => polygon[0] ?? []);
    default:
      return [];
  }
}

/** Centre of the outer rings' bounding box: cheap and good enough for camera targets. */
export function geometryCenter(geometry: Geometry): LngLat | undefined {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of positions(geometry)) {
    if (lng === undefined || lat === undefined) continue;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return Number.isFinite(west) ? [(west + east) / 2, (south + north) / 2] : undefined;
}

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** Converts one feature of buildings.geojson into the domain model, or `undefined` if it is malformed. */
export function parseBuilding(feature: {
  properties: Record<string, unknown> | null;
  geometry: Geometry;
}): Building | undefined {
  const properties = feature.properties;
  const center = geometryCenter(feature.geometry);
  if (!properties || typeof properties.id !== 'string' || !center) return undefined;

  const height = Number(properties.h);
  const minHeight = Number(properties.mh);
  return {
    id: properties.id,
    name: optionalString(properties.name),
    shortName: optionalString(properties.sn),
    kind: optionalString(properties.kind) ?? 'yes',
    height: Number.isFinite(height) ? height : 0,
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    center,
    access: {
      status: decodeAccess(properties.acc),
      source: properties.src === 'curated' ? 'curated' : 'osm',
    },
  };
}
