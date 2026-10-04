import type { Geometry } from 'geojson';
import { type AccessCode, decodeAccess } from '../../domain/access';
import { geometryCenter } from '../../domain/geo';
import type { Building, DataSource } from '../../domain/types';

/** Property schema of public/data/buildings.geojson, written by scripts/build-campus.ts. */
export type BuildingProperties = {
  id: string;
  name?: string;
  /** Short name. */
  sn?: string;
  /** Institute id (see institutes.json). */
  inst?: string;
  kind: string;
  /** Height in metres. */
  h: number;
  /** Base height in metres (above 0 for roofs and raised parts). */
  mh: number;
  acc: AccessCode;
  src: DataSource;
};

export const optionalString = (value: unknown) =>
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
    institute: optionalString(properties.inst),
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
