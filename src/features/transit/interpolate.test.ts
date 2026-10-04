import { describe, expect, it } from 'vitest';
import type { BusVehicle, LngLat } from '../../domain/types';
import { advance, buildShape, GLIDE_MS, pointAt, poseOf, project, shownDistance } from './interpolate';

// 0.001° of latitude is about 111.2 m; 0.001° of longitude at this latitude about 101.9 m.
const NORTH_100M = 100 / 111.195;
const origin: LngLat = [-46.73, -23.56];
const north = (meters: number): LngLat => [origin[0], origin[1] + (meters * NORTH_100M) / 100_000];

/** An L: 500 m north, then east. */
const corner = north(500);
const shape = buildShape([origin, corner, [corner[0] + 0.005, corner[1]]]);

const bus = (position: LngLat, recordedAt: number, extra: Partial<BusVehicle> = {}): BusVehicle => ({
  id: '82619', lineId: '8022-10', direction: 1, position, recordedAt, accessible: true, ...extra,
});

describe('buildShape', () => {
  it('measures distance along the line', () => {
    expect(shape.cumulative[1]).toBeCloseTo(500, 0);
    expect(shape.length).toBeGreaterThan(1000);
  });
});

describe('project', () => {
  it('finds the distance along and the offset from the route', () => {
    const result = project(shape, [origin[0] + 0.0001, north(200)[1]]);
    expect(result.distance).toBeCloseTo(200, 0);
    expect(result.offset).toBeCloseTo(10.2, 0);
  });

  it('clamps beyond the ends', () => {
    expect(project(shape, north(-50)).distance).toBe(0);
  });

  it('uses the previous distance to choose between two passes of the same place', () => {
    // Out and back along the same street.
    const outAndBack = buildShape([origin, north(400), origin]);
    const position = north(100);
    expect(project(outAndBack, position, 50).distance).toBeCloseTo(100, 0);
    expect(project(outAndBack, position, 650).distance).toBeCloseTo(700, 0);
  });
});

describe('pointAt', () => {
  it('interpolates position and gives the heading of the segment', () => {
    const first = pointAt(shape, 250);
    expect(first.position[1]).toBeCloseTo(north(250)[1], 6);
    expect(first.heading).toBeCloseTo(0, 5);
    expect(pointAt(shape, 600).heading).toBeCloseTo(Math.PI / 2, 5);
  });

  it('clamps to the ends of the route', () => {
    expect(pointAt(shape, -10).position).toEqual(origin);
    expect(pointAt(shape, 1e9).position[0]).toBeCloseTo(corner[0] + 0.005, 6);
  });
});

describe('advance', () => {
  const t0 = 1_000_000;

  it('places a bus directly the first time it is seen', () => {
    const track = advance(undefined, bus(north(100), t0), shape, t0);
    expect(track.from).toBeCloseTo(100, 0);
    expect(track.to).toBe(track.from);
    expect(track.onRoute).toBe(true);
  });

  it('glides to a new fix and never passes it', () => {
    const first = advance(undefined, bus(north(100), t0), shape, t0);
    const second = advance(first, bus(north(300), t0 + 20_000), shape, t0 + 20_000);
    expect(shownDistance(second, t0 + 20_000)).toBeCloseTo(100, 0);
    expect(shownDistance(second, t0 + 20_000 + GLIDE_MS / 2)).toBeCloseTo(200, 0);
    expect(shownDistance(second, t0 + 20_000 + GLIDE_MS)).toBeCloseTo(300, 0);
    expect(shownDistance(second, t0 + 20_000 + GLIDE_MS * 5)).toBeCloseTo(300, 0);
  });

  it('continues from where the bus is drawn when a fix arrives mid-glide', () => {
    const first = advance(undefined, bus(north(100), t0), shape, t0);
    const second = advance(first, bus(north(300), t0 + 1), shape, t0 + 1);
    const third = advance(second, bus(north(400), t0 + 2), shape, t0 + 1 + GLIDE_MS / 2);
    expect(third.from).toBeCloseTo(200, 0);
    expect(third.to).toBeCloseTo(400, 0);
  });

  it('keeps gliding when the same fix is reported again', () => {
    const first = advance(undefined, bus(north(100), t0), shape, t0);
    const second = advance(first, bus(north(300), t0 + 1), shape, t0 + 1);
    const repeated = advance(second, bus(north(300), t0 + 1), shape, t0 + 15_000);
    expect(repeated.startedAt).toBe(second.startedAt);
    expect(repeated.to).toBe(second.to);
  });

  it('snaps on a large jump, on reversing, and on a change of direction', () => {
    const first = advance(undefined, bus(north(100), t0), shape, t0);
    const jumped = advance(first, bus([corner[0] + 0.004, corner[1]], t0 + 1), shape, t0 + 1);
    expect(jumped.from).toBe(jumped.to);

    const far = advance(undefined, bus(north(400), t0), shape, t0);
    const reversed = advance(far, bus(north(200), t0 + 1), shape, t0 + 1);
    expect(reversed.from).toBeCloseTo(200, 0);
    expect(reversed.to).toBe(reversed.from);

    const otherWay = advance(first, bus(north(300), t0 + 1, { direction: 0 }), shape, t0 + 1);
    expect(otherWay.from).toBe(otherWay.to);
  });

  it('ignores a small step backwards instead of reversing', () => {
    const first = advance(undefined, bus(north(200), t0), shape, t0);
    const noisy = advance(first, bus(north(185), t0 + 1), shape, t0 + 1);
    expect(noisy.from).toBeCloseTo(200, 0);
    expect(noisy.to).toBeCloseTo(200, 0);
  });

  it('shows an off-route bus at its reported position', () => {
    const away: LngLat = [origin[0] - 0.002, north(200)[1]];
    const track = advance(undefined, bus(away, t0), shape, t0);
    expect(track.onRoute).toBe(false);
    expect(poseOf(track, shape, t0 + 5_000).position).toEqual(away);
  });
});
