import { describe, expect, it } from 'vitest';
import type { Arrival, BusStop, LineDirection, LngLat } from '../../domain/types';
import type { BusPose, BusRoute } from './busTracker';
import { buildShape } from './interpolate';
import { CAMPUS_BUS_SPEED, estimateTrackedArrivals, mergeArrivals } from './trackedArrivals';

const NOW = Date.parse('2026-10-06T21:20:00-03:00');

/** About 100 m per 0.001° of longitude at this latitude is close enough; tests use ratios. */
const east = (steps: number): LngLat => [-46.73 + steps * 0.001, -23.56];

const positions = new Map<string, LngLat>([['a', east(0)], ['b', east(4)], ['c', east(8)], ['d', east(10)]]);
const stop = (id: string, lineIds: string[]): BusStop => ({ id, name: id, position: positions.get(id)!, lineIds, access: 'unknown' });

function route(lineId: string, direction: 0 | 1, headsign: string, stopIds: string[], shape: LngLat[]): BusRoute {
  const line: LineDirection = { lineId, direction, headsign, name: '', color: '#000000', stopIds, shape };
  return { line, shape: buildShape(shape) };
}

// A line that goes out (a, b, d) and comes back by the same street (d, c, a), and a loop that does both in one direction.
const out = route('8082-10', 0, 'Metrô', ['a', 'b', 'd'], [east(0), east(10)]);
const back = route('8082-10', 1, 'Campus', ['d', 'c', 'a'], [east(10), east(0)]);
const loop = route('8085-10', 0, 'Circular', ['a', 'b', 'd', 'c', 'a'], [east(0), east(10), east(0)]);
const routes = [out, back, loop];
const routeOf = (lineId: string, direction: number) => routes.find((entry) => entry.line.lineId === lineId && entry.line.direction === direction);
const positionOf = (stopId: string) => positions.get(stopId);

const bus = (id: string, on: BusRoute, fraction: number, extra: Partial<BusPose> = {}): BusPose => ({
  id,
  lineId: on.line.lineId,
  direction: on.line.direction,
  headsign: on.line.headsign,
  color: '#000000',
  accessible: true,
  recordedAt: NOW,
  position: east(0),
  heading: 0,
  along: on.shape.length * fraction,
  onRoute: true,
  ...extra,
});

const estimate = (at: BusStop, poses: BusPose[]) => estimateTrackedArrivals(at, poses, routeOf, positionOf, NOW);
const seconds = (arrival: Arrival) => (arrival.time - NOW) / 1000;

describe('estimateTrackedArrivals', () => {
  it('estimates a bus that has the stop ahead on its own direction', () => {
    const [arrival, ...rest] = estimate(stop('b', ['8082-10']), [bus('1', out, 0.1)]);
    expect(rest).toEqual([]);
    expect(arrival).toMatchObject({ lineId: '8082-10', headsign: 'Metrô', source: 'estimated', vehicleId: '1', accessible: true });
    expect(seconds(arrival!)).toBeCloseTo((out.shape.length * 0.3) / CAMPUS_BUS_SPEED, 0);
  });

  it('counts a bus on the other direction that still has to turn round', () => {
    // Stop c is only called at on the way back; the bus is half way out.
    const [arrival] = estimate(stop('c', ['8082-10']), [bus('1', out, 0.5)]);
    expect(arrival).toMatchObject({ headsign: 'Campus', vehicleId: '1' });
    expect(seconds(arrival!)).toBeCloseTo((out.shape.length * 0.5 + back.shape.length * 0.2) / CAMPUS_BUS_SPEED, 0);
  });

  it('counts the next lap of a loop line once the bus has passed the stop', () => {
    // Stop b is at 20% of the loop; the bus is at 60%.
    const [arrival] = estimate(stop('b', ['8085-10']), [bus('1', loop, 0.6)]);
    expect(seconds(arrival!)).toBeCloseTo((loop.shape.length * 0.6) / CAMPUS_BUS_SPEED, 0);
  });

  it('uses the second call of a loop at a stop it calls at twice', () => {
    const [arrival] = estimate(stop('a', ['8085-10']), [bus('1', loop, 0.5)]);
    expect(seconds(arrival!)).toBeCloseTo((loop.shape.length * 0.5) / CAMPUS_BUS_SPEED, 0);
  });

  it('leaves out a bus that passed the stop and does not come back to it on the next leg', () => {
    expect(estimate(stop('b', ['8082-10']), [bus('1', out, 0.7)])).toEqual([]);
  });

  it('leaves out buses off their route and lines that do not call at the stop', () => {
    expect(estimate(stop('b', ['8082-10']), [bus('1', out, 0.1, { onRoute: false })])).toEqual([]);
    expect(estimate(stop('b', ['701U-10']), [bus('1', out, 0.1)])).toEqual([]);
  });

  it('lists the soonest bus first', () => {
    const arrivals = estimate(stop('d', ['8082-10', '8085-10']), [bus('far', out, 0.1), bus('near', loop, 0.45)]);
    expect(arrivals.map((arrival) => arrival.vehicleId)).toEqual(['near', 'far']);
  });
});

describe('mergeArrivals', () => {
  const tracked = (lineId: string) => lineId.startsWith('80');
  const row = (lineId: string, minutes: number, source: Arrival['source'], vehicleId?: string): Arrival => ({
    lineId, headsign: '', time: NOW + minutes * 60_000, source, ...(vehicleId && { vehicleId }),
  });
  const summary = (arrivals: Arrival[]) => arrivals.map((arrival) => `${arrival.lineId} ${(arrival.time - NOW) / 60_000} ${arrival.source}`);

  it('puts the tracked lines first, each part soonest first', () => {
    const merged = mergeArrivals(
      [row('701U-10', 1, 'live'), row('8082-10', 9, 'live', '1'), row('702U-10', 4, 'live')],
      [row('8085-10', 6, 'estimated', '2')],
      tracked,
    );
    expect(summary(merged)).toEqual(['8085-10 6 estimated', '8082-10 9 live', '701U-10 1 live', '702U-10 4 live']);
  });

  it('keeps the SPTrans prediction over the estimate for the same bus', () => {
    const merged = mergeArrivals([row('8082-10', 9, 'live', '1')], [row('8082-10', 5, 'estimated', '1')], tracked);
    expect(summary(merged)).toEqual(['8082-10 9 live']);
  });

  it('never drops a tracked bus because the stop has many other lines', () => {
    const others = Array.from({ length: 20 }, (_, index) => row('701U-10', index + 1, 'live'));
    const merged = mergeArrivals([...others, row('8084-10', 40, 'live', '1')], [row('8085-10', 50, 'estimated', '2')], tracked);
    expect(summary(merged).slice(0, 2)).toEqual(['8084-10 40 live', '8085-10 50 estimated']);
    expect(merged).toHaveLength(12);
  });

  it('shows at most two buses of a tracked line, predictions before estimates', () => {
    const merged = mergeArrivals(
      [row('8082-10', 12, 'live', '1')],
      [row('8082-10', 3, 'estimated', '2'), row('8082-10', 5, 'estimated', '3'), row('8082-10', 7, 'estimated', '4')],
      tracked,
    );
    expect(summary(merged)).toEqual(['8082-10 3 estimated', '8082-10 12 live']);
  });

  it('returns nothing when there is nothing', () => {
    expect(mergeArrivals([], [], tracked)).toEqual([]);
  });
});
