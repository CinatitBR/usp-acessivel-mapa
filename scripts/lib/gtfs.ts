import type { LngLat } from '../../src/domain/types';

/** Parses one CSV line, honouring double quotes (GTFS stop names contain commas). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      fields.push(field);
      field = '';
    } else field += char;
  }
  fields.push(field);
  return fields;
}

/**
 * Reads a GTFS table into objects keyed by the header row. `keep` runs on the
 * raw line first, so huge tables (shapes.txt) can be filtered cheaply.
 */
export function parseCsv(text: string, keep?: (line: string) => boolean): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = parseCsvLine(lines[0] ?? '');
  const rows: Record<string, string>[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line || (keep && !keep(line))) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((name, column) => {
      row[name] = values[column] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

const EARTH_RADIUS = 6_371_000;
const RADIANS = Math.PI / 180;

/** Distance in metres; an equirectangular approximation, accurate at campus scale. */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const x = (b[0] - a[0]) * RADIANS * Math.cos(((a[1] + b[1]) / 2) * RADIANS);
  const y = (b[1] - a[1]) * RADIANS;
  return Math.hypot(x, y) * EARTH_RADIUS;
}

function distanceToSegment(point: LngLat, start: LngLat, end: LngLat): number {
  const scale = Math.cos(point[1] * RADIANS);
  const px = (point[0] - start[0]) * scale;
  const py = point[1] - start[1];
  const sx = (end[0] - start[0]) * scale;
  const sy = end[1] - start[1];
  const length = sx * sx + sy * sy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, (px * sx + py * sy) / length));
  return Math.hypot(px - t * sx, py - t * sy) * RADIANS * EARTH_RADIUS;
}

/** Douglas–Peucker: drops points that deviate less than `tolerance` metres from the line. */
export function simplifyLine(points: LngLat[], tolerance: number): LngLat[] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let maxDistance = tolerance;
    for (let index = first + 1; index < last; index += 1) {
      const distance = distanceToSegment(points[index]!, points[first]!, points[last]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = index;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}
