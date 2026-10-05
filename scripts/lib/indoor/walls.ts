import type { Point, SheetPath } from './svgPaths';

/** A straight piece of wall, in metres on the building's own axes. */
export type Segment = [x1: number, y1: number, x2: number, y2: number];

export type WallOptions = {
  /** Lines must lie inside this box, in metres on the building's axes. */
  extent: [x1: number, y1: number, x2: number, y2: number];
  /** Shorter lines, after joining, are furniture, fixtures or dashes. */
  minLength: number;
};

/** Lines closer than this are the same line drawn twice. */
const SAME_LINE_METERS = 0.03;
/** Pieces on one line are joined across a gap this small; the gaps of a dashed line are larger. */
const JOIN_GAP_METERS = 0.06;
/** A line this far off the building's axes, per metre of length, is not a wall. */
const SKEW_LIMIT = 0.01;
const ROUND = 20;

const snap = (value: number) => Math.round(value * ROUND) / ROUND;

/**
 * Picks the walls out of a sheet's linework. The drawing has lost its layers, so
 * this goes by shape alone: walls are straight, follow the building's axes and are
 * long, while furniture, door swings, hatching and dashed projections are curved,
 * skewed or short. Pieces of one wall are joined before their length is judged.
 * `toBuilding` carries a page point to metres on the building's axes.
 */
export function extractWalls(paths: readonly SheetPath[], toBuilding: (point: Point) => Point, options: WallOptions): Segment[] {
  const { extent: [left, top, right, bottom], minLength } = options;
  // Per axis: the spans drawn on each line, keyed by the line's position.
  const lines: [Map<number, [number, number][]>, Map<number, [number, number][]>] = [new Map(), new Map()];

  for (const path of paths) {
    if (path.curved || path.filled) continue;
    for (const stroke of path.strokes) {
      const points = stroke.map(toBuilding);
      for (let index = 1; index < points.length; index++) {
        const [x1, y1] = points[index - 1]!;
        const [x2, y2] = points[index]!;
        const [dx, dy] = [Math.abs(x2 - x1), Math.abs(y2 - y1)];
        const length = Math.max(dx, dy);
        if (length === 0 || Math.min(dx, dy) > SKEW_LIMIT * length + 0.005) continue;
        const horizontal = dx > dy;
        const position = horizontal ? (y1 + y2) / 2 : (x1 + x2) / 2;
        const span: [number, number] = horizontal ? [Math.min(x1, x2), Math.max(x1, x2)] : [Math.min(y1, y2), Math.max(y1, y2)];
        const [low, high, start, end] = horizontal ? [top, bottom, left, right] : [left, right, top, bottom];
        if (position < low || position > high || span[0] < start || span[1] > end) continue;
        const key = Math.round(position / SAME_LINE_METERS);
        const spans = lines[horizontal ? 0 : 1].get(key);
        if (spans) spans.push(span);
        else lines[horizontal ? 0 : 1].set(key, [span]);
      }
    }
  }

  const walls: Segment[] = [];
  lines.forEach((byPosition, axis) => {
    for (const [key, spans] of [...byPosition].sort(([a], [b]) => a - b)) {
      const position = snap(key * SAME_LINE_METERS);
      spans.sort((a, b) => a[0] - b[0]);
      let [start, end] = spans[0]!;
      const flush = () => {
        if (end - start < minLength) return;
        const [from, to] = [snap(start), snap(end)];
        walls.push(axis === 0 ? [from, position, to, position] : [position, from, position, to]);
      };
      for (const [from, to] of spans.slice(1)) {
        if (from - end > JOIN_GAP_METERS) {
          flush();
          [start, end] = [from, to];
        } else if (to > end) {
          end = to;
        }
      }
      flush();
    }
  });
  return walls;
}

/**
 * A flight of stairs to redraw: `treads` lines across the width of `box` (along x), evenly
 * spaced from its top edge to its bottom one. For flights the sheet draws cut by a break
 * line or slightly turned, which come out of `extractWalls` with pieces missing.
 */
export type Flight = { box: [x1: number, y1: number, x2: number, y2: number]; treads: number };

/** How far past the box a tread of the drawing may reach and still be replaced, in metres. */
const FLIGHT_MARGIN = 0.1;

/** Replaces the lines across each flight by evenly spaced treads; everything else is kept. */
export function redrawFlights(walls: readonly Segment[], flights: readonly Flight[]): Segment[] {
  const isTreadOf = ([x1, y1, x2, y2]: Segment, { box: [left, top, right, bottom] }: Flight) =>
    y1 === y2 &&
    y1 >= top - FLIGHT_MARGIN &&
    y1 <= bottom + FLIGHT_MARGIN &&
    Math.min(x1, x2) >= left - FLIGHT_MARGIN &&
    Math.max(x1, x2) <= right + FLIGHT_MARGIN;
  const kept = walls.filter((wall) => !flights.some((flight) => isTreadOf(wall, flight)));
  for (const { box: [left, top, right, bottom], treads } of flights) {
    if (treads < 2) throw new Error('A flight needs at least 2 treads');
    for (let index = 0; index < treads; index++) {
      const y = snap(top + ((bottom - top) * index) / (treads - 1));
      kept.push([left, y, right, y]);
    }
  }
  return kept;
}
