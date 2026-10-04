import type { BusVehicle, LineDirection, LngLat } from '../../domain/types';
import { advance, buildShape, poseOf, type Shape, type Track } from './interpolate';

/** A fix this much older than the newest one in the same response is a parked or lost bus. */
const STALE_MS = 3 * 60_000;
/** Hard cap on buses drawn; matches the instance budget of the 3D layer. */
export const MAX_BUSES = 64;

export type BusPose = {
  id: string;
  lineId: string;
  headsign: string;
  color: string;
  accessible: boolean;
  recordedAt: number;
  position: LngLat;
  /** Radians clockwise from north. */
  heading: number;
};

const routeKey = (lineId: string, direction: number) => `${lineId}:${direction}`;

/**
 * Holds what is known about each live bus and answers "where is every bus
 * right now" for both renderers (2D icons and the Three.js layer). It lives
 * outside React because the 3D layer reads it every frame.
 */
class BusTracker {
  private routes = new Map<string, { line: LineDirection; shape: Shape }>();
  private tracks = new Map<string, Track>();

  setLines(lines: LineDirection[]) {
    this.routes = new Map(
      lines.map((line) => [routeKey(line.lineId, line.direction), { line, shape: buildShape(line.shape) }]),
    );
  }

  /** Replaces the fleet with the latest response. Buses missing from it disappear. */
  ingest(vehicles: BusVehicle[], now: number) {
    // Staleness is judged against the newest fix, not the device clock, which may be wrong.
    const newest = vehicles.reduce((latest, vehicle) => Math.max(latest, vehicle.recordedAt), 0);
    const next = new Map<string, Track>();
    for (const vehicle of vehicles) {
      const route = this.routes.get(routeKey(vehicle.lineId, vehicle.direction));
      if (!route || newest - vehicle.recordedAt > STALE_MS || next.size >= MAX_BUSES) continue;
      next.set(vehicle.id, advance(this.tracks.get(vehicle.id), vehicle, route.shape, now));
    }
    this.tracks = next;
  }

  clear() {
    this.tracks = new Map();
  }

  get count() {
    return this.tracks.size;
  }

  private pose(track: Track, now: number): BusPose | undefined {
    const { vehicle } = track;
    const route = this.routes.get(routeKey(vehicle.lineId, vehicle.direction));
    if (!route) return undefined;
    return {
      id: vehicle.id,
      lineId: vehicle.lineId,
      headsign: route.line.headsign,
      color: route.line.color,
      accessible: vehicle.accessible,
      recordedAt: vehicle.recordedAt,
      ...poseOf(track, route.shape, now),
    };
  }

  poses(now: number): BusPose[] {
    const poses: BusPose[] = [];
    for (const track of this.tracks.values()) {
      const pose = this.pose(track, now);
      if (pose) poses.push(pose);
    }
    return poses;
  }

  get(id: string, now: number): BusPose | undefined {
    const track = this.tracks.get(id);
    return track && this.pose(track, now);
  }
}

export const busTracker = new BusTracker();
