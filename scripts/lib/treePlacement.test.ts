import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../src/domain/types';
import { pointInGeometry } from '../../src/domain/geo';
import {
  areaSquareMeters,
  circlePolygon,
  clumpNoise,
  isStreetRow,
  keepSome,
  projector,
  SegmentIndex,
  streetLineTrees,
  type Xy,
} from './treePlacement';

const ORIGIN: LngLat = [-46.7283, -23.5611];
const toXy = projector(ORIGIN);

describe('projector', () => {
  it('measures metres east and north of the origin', () => {
    expect(toXy(ORIGIN)).toEqual([0, 0]);
    const [x, y] = toXy([ORIGIN[0], ORIGIN[1] + 0.001]);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(111.2, 0);
  });
});

describe('SegmentIndex', () => {
  const index = new SegmentIndex();
  // A street running 300 m east from the origin.
  index.addLine([[0, 0], [150, 0], [300, 0]]);

  it('finds points beside a segment, including across grid cells', () => {
    expect(index.within([100, 5], 7)).toBe(true);
    expect(index.within([39, -6.9], 7)).toBe(true);
    expect(index.within([250, 14], 15)).toBe(true);
  });

  it('rejects points further away or beyond the ends', () => {
    expect(index.within([100, 8], 7)).toBe(false);
    expect(index.within([320, 0], 7)).toBe(false);
    expect(index.within([100, 500], 15)).toBe(false);
  });
});

describe('isStreetRow', () => {
  const nearStreet = ([, y]: Xy) => Math.abs(y) < 15;

  it('is true when most of the row runs beside the street', () => {
    expect(isStreetRow([[0, 5], [10, 5], [20, 5], [30, 40]], nearStreet)).toBe(true);
  });

  it('is false for a row that only touches the street or is empty', () => {
    expect(isStreetRow([[0, 5], [0, 30], [0, 60], [0, 90]], nearStreet)).toBe(false);
    expect(isStreetRow([], nearStreet)).toBe(false);
  });
});

describe('streetLineTrees', () => {
  const nearStreet = ([, y]: Xy) => Math.abs(y) < 12;

  it('marks trees that line a street and leaves the others', () => {
    const trees: Xy[] = [[0, 5], [10, 5], [20, 5], [200, 5], [10, 60], [15, 60], [20, 60]];
    expect(streetLineTrees(trees, nearStreet, 25)).toEqual([true, true, true, false, false, false, false]);
  });
});

describe('keepSome', () => {
  it('keeps about one point in five, and the same ones every time', () => {
    const points = Array.from({ length: 2000 }, (_, index): Xy => [index * 9.3, (index % 37) * 4.1]);
    const kept = points.filter((point) => keepSome(point, 5));
    expect(kept.length).toBeGreaterThan(300);
    expect(kept.length).toBeLessThan(500);
    expect(points.filter((point) => keepSome(point, 5))).toEqual(kept);
  });
});

describe('clumpNoise', () => {
  it('stays in [0, 1], is deterministic and changes slowly', () => {
    for (let step = 0; step < 200; step += 1) {
      const point: Xy = [step * 13.7 - 900, step * 7.1 - 400];
      const value = clumpNoise(point, 70);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(clumpNoise(point, 70)).toBe(value);
      expect(Math.abs(clumpNoise([point[0] + 1, point[1]], 70) - value)).toBeLessThan(0.05);
    }
  });
});

describe('areaSquareMeters', () => {
  it('measures a polygon and subtracts its holes', () => {
    const square = (size: number) => {
      const lng = size / (111_195 * Math.cos((ORIGIN[1] * Math.PI) / 180));
      const lat = size / 111_195;
      return [ORIGIN, [ORIGIN[0] + lng, ORIGIN[1]], [ORIGIN[0] + lng, ORIGIN[1] + lat], [ORIGIN[0], ORIGIN[1] + lat], ORIGIN];
    };
    expect(areaSquareMeters({ type: 'Polygon', coordinates: [square(100)] }, toXy)).toBeCloseTo(10_000, -1);
    expect(areaSquareMeters({ type: 'Polygon', coordinates: [square(100), square(10)] }, toXy)).toBeCloseTo(9_900, -1);
    expect(areaSquareMeters({ type: 'Point', coordinates: ORIGIN }, toXy)).toBe(0);
  });
});

describe('circlePolygon', () => {
  it('contains points inside the radius and not those outside', () => {
    const circle = circlePolygon(ORIGIN, 100);
    expect(pointInGeometry([ORIGIN[0], ORIGIN[1] + 0.0008], circle)).toBe(true);
    expect(pointInGeometry([ORIGIN[0], ORIGIN[1] + 0.001], circle)).toBe(false);
    expect(areaSquareMeters(circle, toXy)).toBeCloseTo(Math.PI * 100 * 100, -3);
  });
});
