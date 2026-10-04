import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../src/domain/types';
import { distanceMeters } from './gtfs';
import { alongLine, scatterInPolygon, selectTrees, treeAt, unitHash } from './trees';

// About 200 m × 220 m.
const wood: Polygon = {
  type: 'Polygon',
  coordinates: [[[-46.73, -23.562], [-46.728, -23.562], [-46.728, -23.56], [-46.73, -23.56], [-46.73, -23.562]]],
};

describe('unitHash', () => {
  it('is deterministic and inside [0, 1)', () => {
    expect(unitHash(12, 34)).toBe(unitHash(12, 34));
    expect(unitHash(12, 34)).not.toBe(unitHash(34, 12));
    for (let index = 0; index < 100; index += 1) {
      const value = unitHash(index, index * 7, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('scatterInPolygon', () => {
  it('fills the polygon at roughly one tree per grid cell', () => {
    const points = scatterInPolygon(wood, 12);
    // 204 m × 222 m at 12 m spacing is about 315 cells.
    expect(points.length).toBeGreaterThan(250);
    expect(points.length).toBeLessThan(380);
    expect(points.every(([lng, lat]) => lng >= -46.73 && lng <= -46.728 && lat >= -23.562 && lat <= -23.56)).toBe(true);
  });

  it('gives the same points on every run', () => {
    expect(scatterInPolygon(wood, 12)).toEqual(scatterInPolygon(wood, 12));
  });

  it('skips blocked points', () => {
    const all = scatterInPolygon(wood, 12);
    const half = scatterInPolygon(wood, 12, ([lng]) => lng > -46.729);
    expect(half.length).toBeLessThan(all.length * 0.65);
    expect(half.every(([lng]) => lng <= -46.729)).toBe(true);
  });
});

describe('alongLine', () => {
  it('spaces points evenly across segments', () => {
    const line: LngLat[] = [[-46.73, -23.56], [-46.73, -23.5591], [-46.729, -23.5591]];
    const points = alongLine(line, 10);
    // 100 m north then 102 m east.
    expect(points.length).toBeGreaterThanOrEqual(20);
    expect(points.length).toBeLessThanOrEqual(21);
    expect(points[0]).toEqual(line[0]);
    expect(distanceMeters(points[3]!, points[4]!)).toBeCloseTo(10, 0);
  });
});

describe('treeAt', () => {
  it('derives a stable height and seed from the position', () => {
    const tree = treeAt([-46.7301, -23.5605], 7, 13);
    expect(tree).toEqual(treeAt([-46.7301, -23.5605], 7, 13));
    expect(tree.height).toBeGreaterThanOrEqual(7);
    expect(tree.height).toBeLessThanOrEqual(13);
    expect(Number.isInteger(tree.seed) && tree.seed >= 0 && tree.seed < 256).toBe(true);
  });
});

describe('selectTrees', () => {
  const mapped = [treeAt([-46.73, -23.56], 7, 13), treeAt([-46.731, -23.561], 7, 13)];
  const generated = scatterInPolygon(wood, 12).map((point) => treeAt(point, 8, 16));

  it('keeps every mapped tree and thins the generated ones to the budget', () => {
    const selected = selectTrees(mapped, generated, 50);
    expect(selected).toHaveLength(50);
    expect(selected.slice(0, 2)).toEqual(mapped);
  });

  it('thins evenly instead of cutting off one side', () => {
    const selected = selectTrees([], generated, 100);
    const west = selected.filter((tree) => tree.position[0] < -46.729).length;
    expect(west).toBeGreaterThan(30);
    expect(west).toBeLessThan(70);
  });

  it('returns everything when under budget', () => {
    expect(selectTrees(mapped, generated, 10_000)).toHaveLength(mapped.length + generated.length);
  });
});
