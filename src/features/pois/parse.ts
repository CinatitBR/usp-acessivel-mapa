import type { Geometry } from 'geojson';
import { type AccessCode, decodeAccess } from '../../domain/access';
import { geometryCenter } from '../../domain/geo';
import type { DataSource, Poi, PoiCategory } from '../../domain/types';
import { optionalString } from '../buildings/parse';

/** Property schema of public/data/pois.geojson, written by scripts/build-campus.ts. */
export type PoiProperties = {
  id: string;
  name?: string;
  cat: PoiCategory;
  acc: AccessCode;
  /** Id of the containing building. */
  bld?: string;
  /** OSM opening_hours value. */
  oh?: string;
  src: DataSource;
};

export function parsePoi(feature: {
  properties: Record<string, unknown> | null;
  geometry: Geometry;
}): Poi | undefined {
  const properties = feature.properties;
  const position = geometryCenter(feature.geometry);
  if (!properties || typeof properties.id !== 'string' || typeof properties.cat !== 'string' || !position) {
    return undefined;
  }
  return {
    id: properties.id,
    name: optionalString(properties.name),
    category: properties.cat as PoiCategory,
    position,
    access: {
      status: decodeAccess(properties.acc),
      source: properties.src === 'curated' ? 'curated' : 'osm',
    },
    buildingId: optionalString(properties.bld),
    openingHours: optionalString(properties.oh),
  };
}
