import type { Geometry } from 'geojson';
import { geometryBbox, pointInGeometry } from '../../src/domain/geo';
import type { Tree } from '../../src/domain/trees';
import type { LngLat } from '../../src/domain/types';
import { distanceMeters } from './gtfs';

const METERS_PER_DEGREE = 111_195;

/** Deterministic hash of two integers to [0, 1): the same input always grows the same tree. */
export function unitHash(a: number, b: number, salt = 0): number {
  let value = Math.imul(a ^ 0x9e3779b9, 73_856_093) ^ Math.imul(b ^ salt, 19_349_663);
  value = Math.imul(value ^ (value >>> 13), 2_246_822_519);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

const cell = (position: LngLat): [number, number] => [Math.round(position[0] * 1e6), Math.round(position[1] * 1e6)];

/** A tree at a position, with a height in the given range and a stable seed. */
export function treeAt(position: LngLat, minHeight: number, maxHeight: number): Tree {
  const [a, b] = cell(position);
  return {
    position,
    height: Math.round((minHeight + unitHash(a, b, 1) * (maxHeight - minHeight)) * 10) / 10,
    seed: Math.floor(unitHash(a, b, 2) * 256),
  };
}

/**
 * Points on a jittered grid inside a polygon. The grid is anchored to the
 * globe, not to the polygon, so the result is the same on every run.
 */
export function scatterInPolygon(geometry: Geometry, spacing: number, isBlocked: (point: LngLat) => boolean = () => false): LngLat[] {
  const bbox = geometryBbox(geometry);
  if (!bbox) return [];
  const latStep = spacing / METERS_PER_DEGREE;
  const lngStep = spacing / (METERS_PER_DEGREE * Math.cos((bbox[1] * Math.PI) / 180));

  const points: LngLat[] = [];
  for (let row = Math.floor(bbox[1] / latStep); row * latStep <= bbox[3]; row += 1) {
    for (let column = Math.floor(bbox[0] / lngStep); column * lngStep <= bbox[2]; column += 1) {
      const point: LngLat = [
        (column + unitHash(column, row, 3)) * lngStep,
        (row + unitHash(column, row, 4)) * latStep,
      ];
      if (pointInGeometry(point, geometry) && !isBlocked(point)) points.push(point);
    }
  }
  return points;
}

/** Evenly spaced points along a line (a mapped row of trees). */
export function alongLine(line: LngLat[], spacing: number): LngLat[] {
  const points: LngLat[] = [];
  let untilNext = 0;
  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index]!;
    const end = line[index + 1]!;
    const length = distanceMeters(start, end);
    let along = untilNext;
    for (; along <= length; along += spacing) {
      const t = length === 0 ? 0 : along / length;
      points.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
    }
    untilNext = along - length;
  }
  return points;
}

/**
 * Keeps at most `max` trees: every mapped tree first, then the generated ones
 * thinned evenly (by seed order, which is unrelated to position) rather than
 * dropping a whole area.
 */
export function selectTrees(mapped: Tree[], generated: Tree[], max: number): Tree[] {
  const room = Math.max(0, max - mapped.length);
  const thinned = [...generated]
    .sort((a, b) => unitHash(...cell(a.position), 5) - unitHash(...cell(b.position), 5))
    .slice(0, room);
  return [...mapped.slice(0, max), ...thinned];
}
