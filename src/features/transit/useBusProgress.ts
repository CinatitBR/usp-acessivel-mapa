import { useEffect, useMemo, useState } from 'react';
import type { BusStop, LineDirection } from '../../domain/types';
import { loadStops } from '../../map/staticData';
import { type BusPose, busTracker } from './busTracker';
import { type LocatedStop, locateStops, passedCount, targetIndex } from './lineStops';

export type BusProgress = {
  pose: BusPose;
  line: LineDirection;
  /** The stops of the bus's line direction, in calling order. */
  stops: BusStop[];
  /** Same order as `stops`. */
  located: LocatedStop[];
  /** How many of `stops` are behind the bus. */
  passed: number;
  /** Index in `stops` of the stop the bus was opened from, when it is on this direction. */
  target?: number;
};

/** All stops by id, loaded once. Empty until the file arrives (or if it fails: the timeline is then empty). */
export function useStopsById(): Map<string, BusStop> | undefined {
  const [stops, setStops] = useState<Map<string, BusStop>>();
  useEffect(() => {
    let cancelled = false;
    loadStops().then(
      (loaded) => !cancelled && setStops(new Map(loaded.map((stop) => [stop.id, stop]))),
      () => !cancelled && setStops(new Map()),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return stops;
}

/**
 * Where a live bus is on its line: read again every `intervalMs`, because the
 * tracker lives outside React. Undefined while the bus is not in the feed.
 */
export function useBusProgress(id: string | undefined, fromStop: string | undefined, intervalMs: number): BusProgress | undefined {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!id) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [id, intervalMs]);

  const stopsById = useStopsById();
  const pose = id ? busTracker.get(id, now) : undefined;
  const route = pose && busTracker.route(pose.lineId, pose.direction);

  // Placing the stops is the costly part and only depends on the line.
  const placed = useMemo(() => {
    if (!route || !stopsById) return undefined;
    const stops = route.line.stopIds.flatMap((stopId) => stopsById.get(stopId) ?? []);
    return { stops, located: locateStops(route.shape, stops.map((stop) => stop.position)) };
  }, [route, stopsById]);

  if (!pose || !route || !placed) return undefined;
  // A bus off its route (detour, garage run) has no meaningful progress: nothing is marked as passed.
  const passed = pose.onRoute ? passedCount(placed.located, pose.along) : 0;
  const target = fromStop === undefined ? undefined : targetIndex(placed.stops.map((stop) => stop.id), fromStop, passed);
  return { pose, line: route.line, ...placed, passed, ...(target !== undefined && { target }) };
}
