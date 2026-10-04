import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { bboxContains, geometryBbox, geometryCenter, pointInGeometry } from './geo';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [[[-46.73, -23.56], [-46.72, -23.56], [-46.72, -23.55], [-46.73, -23.55], [-46.73, -23.56]]],
};

const withHole: Polygon = {
  type: 'Polygon',
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
};

describe('geometryCenter', () => {
  it('returns the bounding-box centre of a polygon', () => {
    const center = geometryCenter(square);
    expect(center?.[0]).toBeCloseTo(-46.725);
    expect(center?.[1]).toBeCloseTo(-23.555);
  });

  it('covers every part of a multipolygon', () => {
    const center = geometryCenter({
      type: 'MultiPolygon',
      coordinates: [square.coordinates, [[[-46.71, -23.56], [-46.7, -23.56], [-46.7, -23.55], [-46.71, -23.56]]]],
    });
    expect(center?.[0]).toBeCloseTo(-46.715);
  });

  it('handles points and lines', () => {
    expect(geometryCenter({ type: 'Point', coordinates: [1, 2] })).toEqual([1, 2]);
    expect(geometryCenter({ type: 'LineString', coordinates: [[0, 0], [2, 4]] })).toEqual([1, 2]);
  });

  it('returns undefined for empty geometry', () => {
    expect(geometryCenter({ type: 'Polygon', coordinates: [] })).toBeUndefined();
  });
});

describe('pointInGeometry', () => {
  it('detects points inside and outside a polygon', () => {
    expect(pointInGeometry([-46.725, -23.555], square)).toBe(true);
    expect(pointInGeometry([-46.74, -23.555], square)).toBe(false);
  });

  it('excludes holes', () => {
    expect(pointInGeometry([2, 2], withHole)).toBe(true);
    expect(pointInGeometry([5, 5], withHole)).toBe(false);
  });

  it('checks every part of a multipolygon', () => {
    const multi = { type: 'MultiPolygon' as const, coordinates: [withHole.coordinates, [[[20, 20], [30, 20], [30, 30], [20, 20]]]] };
    expect(pointInGeometry([28, 22], multi)).toBe(true);
    expect(pointInGeometry([15, 15], multi)).toBe(false);
  });

  it('is false for non-area geometry', () => {
    expect(pointInGeometry([1, 2], { type: 'Point', coordinates: [1, 2] })).toBe(false);
  });
});

describe('bbox helpers', () => {
  it('computes and tests a bounding box', () => {
    const bbox = geometryBbox(square)!;
    expect(bbox).toEqual([-46.73, -23.56, -46.72, -23.55]);
    expect(bboxContains(bbox, [-46.725, -23.555])).toBe(true);
    expect(bboxContains(bbox, [-46.7, -23.555])).toBe(false);
  });
});
