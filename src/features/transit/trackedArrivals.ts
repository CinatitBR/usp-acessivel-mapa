import type { Arrival, BusStop, LngLat } from '../../domain/types';
import type { BusPose, BusRoute } from './busTracker';
import { type LocatedStop, locateStops, passedCount } from './lineStops';
import { MAX_ARRIVALS } from './providers/types';

/**
 * Average speed of a campus bus, stops included, in metres per second (27 km/h).
 * Set so that these estimates agree with what SPTrans predicts for the same
 * buses where it does predict (39 pairs on the evening of 2026-10-06, median
 * ratio 0.92 at 8 m/s). In daytime traffic the buses are slower, so an estimate
 * tends to be early rather than late, which is the safer way to be wrong.
 */
export const CAMPUS_BUS_SPEED = 7.5;
/** Rows of one tracked line in a stop panel, predictions and estimates together. */
const MAX_PER_TRACKED_LINE = 2;
/** Other lines keep at least this many rows, however many tracked buses are listed. */
const MIN_OTHER_ARRIVALS = 6;

type Calls = { stopIds: string[]; located: LocatedStop[] };

/** Placing stops along a route is the costly part and only depends on the route. */
const callsByRoute = new WeakMap<BusRoute, Calls>();

function callsOf(route: BusRoute, positionOf: (stopId: string) => LngLat | undefined): Calls {
  const cached = callsByRoute.get(route);
  if (cached) return cached;
  const known = route.line.stopIds.flatMap((stopId) => {
    const position = positionOf(stopId);
    return position ? [{ stopId, position }] : [];
  });
  const calls = {
    stopIds: known.map((call) => call.stopId),
    located: locateStops(route.shape, known.map((call) => call.position)),
  };
  callsByRoute.set(route, calls);
  return calls;
}

/** Metres from `from` along the route to its next call at the stop, if it has one. */
function distanceToCall(calls: Calls, stopId: string, from: number): number | undefined {
  const index = calls.stopIds.indexOf(stopId, passedCount(calls.located, from));
  return index < 0 ? undefined : Math.max(0, calls.located[index]!.along - from);
}

/**
 * Arrivals at a stop worked out from where the tracked buses are, for when
 * SPTrans predicts nothing: it leaves out some campus stops, and a bus that
 * still has to turn round at the end of its line. A bus counts when the stop is
 * ahead on its own direction, or on the leg it runs next: the way back, or the
 * next lap of a loop line. One row per bus, soonest first.
 *
 * A bus waiting at a terminal is taken to leave now, so its time is the earliest it can be.
 */
export function estimateTrackedArrivals(
  stop: BusStop,
  poses: BusPose[],
  routeOf: (lineId: string, direction: number) => BusRoute | undefined,
  positionOf: (stopId: string) => LngLat | undefined,
  now: number,
): Arrival[] {
  const arrivals: Arrival[] = [];
  for (const pose of poses) {
    // A bus off its route (detour, garage run) is not heading anywhere we can tell.
    if (!pose.onRoute || !stop.lineIds.includes(pose.lineId)) continue;
    const own = routeOf(pose.lineId, pose.direction);
    if (!own) continue;

    let headsign = own.line.headsign;
    let distance = distanceToCall(callsOf(own, positionOf), stop.id, pose.along);
    if (distance === undefined) {
      // A line with no other direction is a loop: the next leg is the same route again.
      const next = routeOf(pose.lineId, 1 - pose.direction) ?? own;
      const onNext = distanceToCall(callsOf(next, positionOf), stop.id, 0);
      if (onNext === undefined) continue;
      distance = Math.max(0, own.shape.length - pose.along) + onNext;
      headsign = next.line.headsign;
    }

    arrivals.push({
      lineId: pose.lineId,
      headsign,
      time: now + (distance / CAMPUS_BUS_SPEED) * 1000,
      source: 'estimated',
      vehicleId: pose.id,
      accessible: pose.accessible,
    });
  }
  return arrivals.sort((a, b) => a.time - b.time);
}

/**
 * The list a stop panel shows: tracked lines first, then the others, each part
 * soonest first. A prediction from SPTrans replaces the estimate for the same
 * bus. Only the other lines are cut to fit, so a tracked bus is never dropped
 * because a busy stop has many lines.
 */
export function mergeArrivals(provided: Arrival[], estimated: Arrival[], isTracked: (lineId: string) => boolean): Arrival[] {
  const byTime = (a: Arrival, b: Arrival) => a.time - b.time;
  const tracked: Arrival[] = [];
  const perLine = new Map<string, number>();
  const predicted = new Set(provided.flatMap((arrival) => (arrival.source === 'live' && arrival.vehicleId ? [arrival.vehicleId] : [])));
  const candidates = [
    ...provided.filter((arrival) => isTracked(arrival.lineId)).sort(byTime),
    ...estimated.filter((arrival) => !arrival.vehicleId || !predicted.has(arrival.vehicleId)).sort(byTime),
  ];
  for (const arrival of candidates) {
    const count = perLine.get(arrival.lineId) ?? 0;
    if (count >= MAX_PER_TRACKED_LINE) continue;
    perLine.set(arrival.lineId, count + 1);
    tracked.push(arrival);
  }

  const others = provided.filter((arrival) => !isTracked(arrival.lineId)).sort(byTime);
  return [...tracked.sort(byTime), ...others.slice(0, Math.max(MIN_OTHER_ARRIVALS, MAX_ARRIVALS - tracked.length))];
}
