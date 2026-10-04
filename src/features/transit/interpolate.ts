import type { BusVehicle, LngLat } from '../../domain/types';

const EARTH_RADIUS = 6_371_000;
const RADIANS = Math.PI / 180;

/** A bus is drawn along its route only while its fix is this close to the route. */
const MAX_OFFSET_METERS = 60;
/** A forward jump larger than this is a new position, not movement to animate. */
const MAX_JUMP_METERS = 600;
/** Small backward steps are GPS noise and are ignored; larger ones snap. */
const MAX_REVERSE_METERS = 40;
/** When a route passes the same place twice, candidates this close to the best match compete. */
const AMBIGUITY_METERS = 15;
/** Time to glide from the shown position to a new fix: one polling interval. */
export const GLIDE_MS = 20_000;

type Xy = [x: number, y: number];

/** A route prepared for projection: local metres and distance along the line. */
export type Shape = {
  points: LngLat[];
  xy: Xy[];
  /** Distance from the start to each point, in metres. */
  cumulative: number[];
  length: number;
};

export type Pose = {
  position: LngLat;
  /** Radians clockwise from north. */
  heading: number;
};

export function buildShape(points: LngLat[]): Shape {
  const [lng0, lat0] = points[0] ?? [0, 0];
  const scale = Math.cos(lat0 * RADIANS);
  const xy = points.map(([lng, lat]): Xy => [
    (lng - lng0) * RADIANS * scale * EARTH_RADIUS,
    (lat - lat0) * RADIANS * EARTH_RADIUS,
  ]);
  const cumulative = [0];
  for (let index = 1; index < xy.length; index += 1) {
    cumulative.push(cumulative[index - 1]! + Math.hypot(xy[index]![0] - xy[index - 1]![0], xy[index]![1] - xy[index - 1]![1]));
  }
  return { points, xy, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
}

function toXy(shape: Shape, [lng, lat]: LngLat): Xy {
  const [lng0, lat0] = shape.points[0]!;
  return [(lng - lng0) * RADIANS * Math.cos(lat0 * RADIANS) * EARTH_RADIUS, (lat - lat0) * RADIANS * EARTH_RADIUS];
}

export type Projection = {
  /** Metres along the route. */
  distance: number;
  /** Metres between the position and the route. */
  offset: number;
};

/** The closest point of every segment of the route to `position`. */
export function projections(shape: Shape, position: LngLat): Projection[] {
  const [px, py] = toXy(shape, position);
  const candidates: Projection[] = [];
  for (let index = 0; index < shape.xy.length - 1; index += 1) {
    const [ax, ay] = shape.xy[index]!;
    const [bx, by] = shape.xy[index + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    candidates.push({
      distance: shape.cumulative[index]! + t * Math.sqrt(lengthSquared),
      offset: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)),
    });
  }
  return candidates;
}

/**
 * Nearest place on the route to `position`: its distance along the route and
 * how far off the route the position is. Where the route passes the same spot
 * more than once, `near` (the previous distance along) picks the pass to use.
 */
export function project(shape: Shape, position: LngLat, near?: number): Projection {
  const candidates = projections(shape, position);
  if (candidates.length === 0) return { distance: 0, offset: Infinity };

  const best = candidates.reduce((a, b) => (b.offset < a.offset ? b : a));
  if (near === undefined) return best;
  return candidates
    .filter((candidate) => candidate.offset <= best.offset + AMBIGUITY_METERS)
    .reduce((a, b) => (Math.abs(b.distance - near) < Math.abs(a.distance - near) ? b : a));
}

/** Position and direction of travel at a distance along the route. */
export function pointAt(shape: Shape, distance: number): Pose {
  const clamped = Math.max(0, Math.min(shape.length, distance));
  let index = 0;
  while (index < shape.cumulative.length - 2 && shape.cumulative[index + 1]! < clamped) index += 1;
  const start = shape.cumulative[index]!;
  const span = (shape.cumulative[index + 1] ?? start) - start;
  const t = span === 0 ? 0 : (clamped - start) / span;
  const [aLng, aLat] = shape.points[index]!;
  const [bLng, bLat] = shape.points[index + 1] ?? shape.points[index]!;
  const [ax, ay] = shape.xy[index]!;
  const [bx, by] = shape.xy[index + 1] ?? shape.xy[index]!;
  return {
    position: [aLng + (bLng - aLng) * t, aLat + (bLat - aLat) * t],
    heading: Math.atan2(bx - ax, by - ay),
  };
}

/** How one bus is being shown: gliding along its route from `from` to `to`. */
export type Track = {
  vehicle: BusVehicle;
  /** Distances along the route, in metres. */
  from: number;
  to: number;
  startedAt: number;
  /** False when the fix is too far from the route to trust the projection. */
  onRoute: boolean;
};

/** Distance along the route the bus is drawn at. It never goes past the latest fix. */
export function shownDistance(track: Track, now: number): number {
  const progress = Math.max(0, Math.min(1, (now - track.startedAt) / GLIDE_MS));
  return track.from + (track.to - track.from) * progress;
}

/**
 * Folds a new fix into a bus's track. Plausible forward movement is animated
 * from wherever the bus is currently drawn; anything else (first sighting,
 * off-route fix, a jump, reversing) places the bus directly.
 */
export function advance(track: Track | undefined, vehicle: BusVehicle, shape: Shape, now: number): Track {
  const sameRoute = track && track.vehicle.lineId === vehicle.lineId && track.vehicle.direction === vehicle.direction;
  const { distance, offset } = project(shape, vehicle.position, sameRoute ? track.to : undefined);
  const onRoute = offset <= MAX_OFFSET_METERS;
  const placed: Track = { vehicle, from: distance, to: distance, startedAt: now, onRoute };

  if (!track || !sameRoute || !onRoute || !track.onRoute) return placed;
  if (vehicle.recordedAt === track.vehicle.recordedAt) return { ...track, vehicle };

  const shown = shownDistance(track, now);
  const delta = distance - shown;
  if (delta > MAX_JUMP_METERS || delta < -MAX_REVERSE_METERS) return placed;
  // A small step backwards is noise: stay put instead of reversing.
  return { vehicle, from: shown, to: Math.max(shown, distance), startedAt: now, onRoute };
}

export function poseOf(track: Track, shape: Shape, now: number): Pose {
  if (!track.onRoute) return { position: track.vehicle.position, heading: pointAt(shape, track.to).heading };
  return pointAt(shape, shownDistance(track, now));
}
