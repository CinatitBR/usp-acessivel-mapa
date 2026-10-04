import type { Geometry, Position } from 'geojson';
import type { LngLat } from '../../src/domain/types';
import { unitHash } from './trees';

const METERS_PER_DEGREE = 111_195;

/** A point in metres east and north of a fixed origin. Distances on the campus are plain Pythagoras in this space. */
export type Xy = [x: number, y: number];

export function projector(origin: LngLat): (point: LngLat | Position) => Xy {
  const scale = METERS_PER_DEGREE * Math.cos((origin[1] * Math.PI) / 180);
  return (point) => [(point[0]! - origin[0]) * scale, (point[1]! - origin[1]) * METERS_PER_DEGREE];
}

/**
 * Line segments in a grid, to answer "is this point within N metres of any of
 * them" for thousands of points without testing every segment.
 */
export class SegmentIndex {
  private cells = new Map<string, [Xy, Xy][]>();

  constructor(private readonly cellSize = 40) {}

  private key = (column: number, row: number) => `${column},${row}`;

  addLine(line: Xy[]) {
    for (let index = 0; index < line.length - 1; index += 1) {
      const a = line[index]!;
      const b = line[index + 1]!;
      const size = this.cellSize;
      for (let column = Math.floor(Math.min(a[0], b[0]) / size); column <= Math.floor(Math.max(a[0], b[0]) / size); column += 1) {
        for (let row = Math.floor(Math.min(a[1], b[1]) / size); row <= Math.floor(Math.max(a[1], b[1]) / size); row += 1) {
          const key = this.key(column, row);
          const segments = this.cells.get(key);
          if (segments) segments.push([a, b]);
          else this.cells.set(key, [[a, b]]);
        }
      }
    }
  }

  /** True when some segment is closer than `meters` to the point. */
  within([x, y]: Xy, meters: number): boolean {
    const size = this.cellSize;
    for (let column = Math.floor((x - meters) / size); column <= Math.floor((x + meters) / size); column += 1) {
      for (let row = Math.floor((y - meters) / size); row <= Math.floor((y + meters) / size); row += 1) {
        for (const [[ax, ay], [bx, by]] of this.cells.get(this.key(column, row)) ?? []) {
          const dx = bx - ax;
          const dy = by - ay;
          const lengthSquared = dx * dx + dy * dy;
          const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
          if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < meters) return true;
        }
      }
    }
    return false;
  }
}

/** A mapped row of trees lines a street when at least half of it runs next to one. */
export function isStreetRow(row: Xy[], nearStreet: (point: Xy) => boolean): boolean {
  return row.length > 0 && row.filter(nearStreet).length * 2 >= row.length;
}

/**
 * Which individually mapped trees are part of a line along a street: next to
 * the street, with at least two other street-side trees close by. A lone tree
 * on a corner is not a line and is left alone.
 */
export function streetLineTrees(trees: Xy[], nearStreet: (point: Xy) => boolean, neighbourMeters: number): boolean[] {
  const beside = trees.map(nearStreet);
  return trees.map((tree, index) => {
    if (!beside[index]) return false;
    let neighbours = 0;
    for (let other = 0; other < trees.length && neighbours < 2; other += 1) {
      if (other !== index && beside[other] && Math.hypot(trees[other]![0] - tree[0], trees[other]![1] - tree[1]) <= neighbourMeters) {
        neighbours += 1;
      }
    }
    return neighbours >= 2;
  });
}

/**
 * Keeps about one point in `oneIn`, chosen by a hash of the position: the same
 * points on every run, and irregular rather than every Nth along a row.
 */
export function keepSome([x, y]: Xy, oneIn: number): boolean {
  return unitHash(Math.round(x * 10), Math.round(y * 10), 6) < 1 / oneIn;
}

/**
 * Smooth noise in [0, 1] that changes over about `scale` metres. Used as tree
 * density, so generated areas get clumps and clearings instead of an even grid.
 */
export function clumpNoise([x, y]: Xy, scale: number): number {
  const column = Math.floor(x / scale);
  const row = Math.floor(y / scale);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const tx = smooth(x / scale - column);
  const ty = smooth(y / scale - row);
  const corner = (dc: number, dr: number) => unitHash(column + dc, row + dr, 7);
  const bottom = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * tx;
  const top = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * tx;
  return bottom + (top - bottom) * ty;
}

/** Area in square metres of a Polygon or MultiPolygon (holes subtracted); 0 for anything else. */
export function areaSquareMeters(geometry: Geometry, toXy: (point: Position) => Xy): number {
  const ring = (positions: Position[]) => {
    let twice = 0;
    for (let i = 0, j = positions.length - 1; i < positions.length; j = i++) {
      const [xi, yi] = toXy(positions[i]!);
      const [xj, yj] = toXy(positions[j]!);
      twice += xj * yi - xi * yj;
    }
    return Math.abs(twice) / 2;
  };
  const polygon = ([outer, ...holes]: Position[][]) => (outer ? ring(outer) - holes.reduce((sum, hole) => sum + ring(hole), 0) : 0);
  if (geometry.type === 'Polygon') return polygon(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.reduce((sum, rings) => sum + polygon(rings), 0);
  return 0;
}

/** A circle as a 32-sided polygon, for areas the overlay gives as centre and radius. */
export function circlePolygon(center: LngLat, radiusMeters: number): Geometry {
  const latStep = radiusMeters / METERS_PER_DEGREE;
  const lngStep = radiusMeters / (METERS_PER_DEGREE * Math.cos((center[1] * Math.PI) / 180));
  const ring = Array.from({ length: 33 }, (_, index) => {
    const angle = ((index % 32) / 32) * 2 * Math.PI;
    return [center[0] + Math.cos(angle) * lngStep, center[1] + Math.sin(angle) * latStep];
  });
  return { type: 'Polygon', coordinates: [ring] };
}
