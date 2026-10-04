import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../domain/types';
import { buildShape } from './interpolate';
import { estimateTimes, locateStops, passedCount, targetIndex } from './lineStops';

/** About 100 m per 0.001° of longitude at this latitude is close enough; tests use ratios. */
const east = (steps: number): LngLat => [-46.73 + steps * 0.001, -23.56];

describe('locateStops', () => {
  it('places stops in order along a straight route', () => {
    const shape = buildShape([east(0), east(10)]);
    const stops = locateStops(shape, [east(1), east(4), east(9)]);
    expect(stops[0]!.along).toBeCloseTo(shape.length * 0.1, 0);
    expect(stops[1]!.along).toBeCloseTo(shape.length * 0.4, 0);
    expect(stops[2]!.along).toBeCloseTo(shape.length * 0.9, 0);
    expect(stops.every((stop) => stop.offset < 1)).toBe(true);
  });

  it('keeps the order on a route that goes out and back along the same street', () => {
    // Out to the east and back to the start: every place is passed twice.
    const shape = buildShape([east(0), east(10), east(0)]);
    const stops = locateStops(shape, [east(2), east(8), east(8), east(2)]);
    const half = shape.length / 2;
    expect(stops[0]!.along).toBeCloseTo(half * 0.2, 0);
    expect(stops[1]!.along).toBeCloseTo(half * 0.8, 0);
    // The second call at each place is on the way back.
    expect(stops[2]!.along).toBeGreaterThanOrEqual(stops[1]!.along);
    expect(stops[3]!.along).toBeCloseTo(half * 1.8, 0);
  });

  it('never goes backwards and reports stops that are off the route', () => {
    const shape = buildShape([east(0), east(10)]);
    const off: LngLat = [east(5)[0], -23.561];
    const stops = locateStops(shape, [east(5), [east(5)[0] - 0.0001, -23.56], off]);
    expect(stops[1]!.along).toBeGreaterThanOrEqual(stops[0]!.along);
    expect(stops[2]!.offset).toBeGreaterThan(100);
  });
});

describe('passedCount', () => {
  const stops = [100, 500, 900].map((along) => ({ along, offset: 0 }));

  it('counts the stops behind the bus', () => {
    expect(passedCount(stops, 0)).toBe(0);
    expect(passedCount(stops, 300)).toBe(1);
    expect(passedCount(stops, 2000)).toBe(3);
  });

  it('does not count a stop the bus is standing at', () => {
    expect(passedCount(stops, 510)).toBe(1);
    expect(passedCount(stops, 530)).toBe(2);
  });
});

describe('targetIndex', () => {
  const loop = ['a', 'b', 'c', 'a'];

  it('takes the next call at a stop the line visits twice', () => {
    expect(targetIndex(loop, 'a', 0)).toBe(0);
    expect(targetIndex(loop, 'a', 1)).toBe(3);
  });

  it('falls back to the last call when the bus has passed the stop', () => {
    expect(targetIndex(loop, 'b', 3)).toBe(1);
  });

  it('is undefined for a stop the line does not call at', () => {
    expect(targetIndex(loop, 'x', 0)).toBeUndefined();
  });
});

describe('estimateTimes', () => {
  const stops = [100, 500, 900, 1300].map((along) => ({ along, offset: 0 }));
  const now = 1_000_000;

  it('shares the predicted time out by distance, up to the target stop', () => {
    // Bus at 300 m, target is the stop at 900 m, predicted in 6 minutes.
    const times = estimateTimes(stops, 300, 2, now + 360_000, now);
    expect(times[0]).toBeUndefined();
    expect(times[1]).toBeCloseTo(now + 120_000, 0);
    expect(times[2]).toBe(now + 360_000);
    expect(times[3]).toBeUndefined();
  });

  it('gives nothing once the prediction is in the past', () => {
    expect(estimateTimes(stops, 300, 2, now - 1, now)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
