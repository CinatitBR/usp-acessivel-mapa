import type { Geometry } from 'geojson';
import { type AccessCode, decodeAccess } from '../../domain/access';
import { geometryCenter } from '../../domain/geo';
import type { BusStop } from '../../domain/types';
import { optionalString } from '../buildings/parse';

/** Property schema of public/data/stops.geojson, written by scripts/build-transit.ts. */
export type BusStopProperties = {
  /** GTFS stop_id, which is also the Olho Vivo stop code. */
  id: string;
  name: string;
  /** Address and reference point, as SPTrans describes the stop. */
  ref?: string;
  /** Comma-separated line ids, e.g. `8082-10,701U-10`. */
  lines: string;
  shelter?: boolean;
  acc: AccessCode;
};

/** Property schema of public/data/lines.geojson: one LineString per line and direction. */
export type BusLineProperties = {
  /** Line id, e.g. `8082-10`. */
  id: string;
  /** GTFS direction_id. */
  dir: 0 | 1;
  /** Destination shown on the bus. */
  head: string;
  name: string;
  color: string;
  /** Olho Vivo line code (`cl`) for this direction; absent until resolved with a token. */
  code?: number;
};

export function parseStop(feature: {
  properties: Record<string, unknown> | null;
  geometry: Geometry;
}): BusStop | undefined {
  const properties = feature.properties;
  const position = geometryCenter(feature.geometry);
  if (!properties || typeof properties.id !== 'string' || typeof properties.name !== 'string' || !position) {
    return undefined;
  }
  return {
    id: properties.id,
    name: properties.name,
    description: optionalString(properties.ref),
    position,
    lineIds: typeof properties.lines === 'string' && properties.lines ? properties.lines.split(',') : [],
    ...(typeof properties.shelter === 'boolean' && { shelter: properties.shelter }),
    access: decodeAccess(properties.acc),
  };
}
