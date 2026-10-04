import type { Geometry, Position } from 'geojson';
import type { LngLat } from './types';

export type Bbox = [west: number, south: number, east: number, north: number];

function* positions(coordinates: unknown): Generator<Position> {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === 'number') yield coordinates as Position;
  else for (const child of coordinates) yield* positions(child);
}

export function geometryBbox(geometry: Geometry): Bbox | undefined {
  if (geometry.type === 'GeometryCollection') return undefined;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of positions(geometry.coordinates)) {
    if (lng === undefined || lat === undefined) continue;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return Number.isFinite(west) ? [west, south, east, north] : undefined;
}

/** Centre of the bounding box: cheap and good enough for camera targets and labels. */
export function geometryCenter(geometry: Geometry): LngLat | undefined {
  const bbox = geometryBbox(geometry);
  return bbox && [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

export function bboxContains(bbox: Bbox, [lng, lat]: LngLat): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function inRing([x, y]: LngLat, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(point: LngLat, rings: Position[][]): boolean {
  const [outer, ...holes] = rings;
  return !!outer && inRing(point, outer) && !holes.some((hole) => inRing(point, hole));
}

/** True when the point lies inside a Polygon or MultiPolygon (holes excluded). Other geometry types never contain a point. */
export function pointInGeometry(point: LngLat, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') return inPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((rings) => inPolygon(point, rings));
  return false;
}
