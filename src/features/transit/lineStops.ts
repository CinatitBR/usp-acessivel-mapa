import type { LngLat } from '../../domain/types';
import { projections, type Shape } from './interpolate';

/** Where the route passes the same place twice, passes this close to the best match compete. */
const AMBIGUITY_METERS = 15;
/** A stop may project slightly behind the previous one (two stops facing each other, GPS rounding). */
const BACKWARD_SLACK_METERS = 30;
/** A bus counts as past a stop once it is this far beyond it; at the stop itself it is still "arriving". */
const PASSED_MARGIN_METERS = 20;

export type LocatedStop = {
  /** Metres along the route. Never smaller than the previous stop's. */
  along: number;
  /** Metres between the stop and the route. */
  offset: number;
};

/**
 * Places the stops of a line along its route, in calling order. Each stop takes
 * the earliest pass of the route that is beyond the previous stop, so a loop
 * that runs down the same street twice keeps its stops in order.
 */
export function locateStops(shape: Shape, positions: LngLat[]): LocatedStop[] {
  const located: LocatedStop[] = [];
  let previous = 0;
  for (const position of positions) {
    const all = projections(shape, position);
    const ahead = all.filter((candidate) => candidate.distance >= previous - BACKWARD_SLACK_METERS);
    const candidates = ahead.length > 0 ? ahead : all;
    if (candidates.length === 0) {
      located.push({ along: previous, offset: Infinity });
      continue;
    }
    const best = candidates.reduce((a, b) => (b.offset < a.offset ? b : a));
    const chosen = candidates
      .filter((candidate) => candidate.offset <= best.offset + AMBIGUITY_METERS)
      .reduce((a, b) => (b.distance < a.distance ? b : a));
    previous = Math.max(previous, chosen.distance);
    located.push({ along: previous, offset: chosen.offset });
  }
  return located;
}

/** How many stops, from the start of the line, the bus has already left behind. */
export function passedCount(stops: LocatedStop[], busAlong: number): number {
  let count = 0;
  while (count < stops.length && stops[count]!.along + PASSED_MARGIN_METERS < busAlong) count += 1;
  return count;
}

/**
 * Index of the user's stop in the line's calling order: the first call the bus
 * has not passed yet, or the last call when it has passed them all. A loop
 * line can call at the same stop twice.
 */
export function targetIndex(stopIds: string[], stopId: string, passed: number): number | undefined {
  const next = stopIds.indexOf(stopId, passed);
  const index = next >= 0 ? next : stopIds.lastIndexOf(stopId);
  return index >= 0 ? index : undefined;
}

/**
 * Arrival times at the stops between the bus and the user's stop. Only the time
 * at the user's stop is a real prediction; the others share it out by distance,
 * so they are estimates. Passed stops and stops beyond the target get none.
 */
export function estimateTimes(
  stops: LocatedStop[],
  busAlong: number,
  target: number,
  targetTime: number,
  now: number,
): (number | undefined)[] {
  const span = (stops[target]?.along ?? 0) - busAlong;
  const passed = passedCount(stops, busAlong);
  return stops.map((stop, index) => {
    if (index < passed || index > target || targetTime <= now) return undefined;
    if (index === target || span <= 0) return index === target ? targetTime : undefined;
    const share = Math.max(0, Math.min(1, (stop.along - busAlong) / span));
    return now + (targetTime - now) * share;
  });
}
