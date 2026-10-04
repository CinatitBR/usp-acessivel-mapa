import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { geometryCenter, parseBuilding } from './parse';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [[[-46.73, -23.56], [-46.72, -23.56], [-46.72, -23.55], [-46.73, -23.55], [-46.73, -23.56]]],
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
      coordinates: [square.coordinates, [[[-46.71, -23.56], [-46.70, -23.56], [-46.70, -23.55], [-46.71, -23.56]]]],
    });
    expect(center?.[0]).toBeCloseTo(-46.715);
  });

  it('returns undefined for geometry without rings', () => {
    expect(geometryCenter({ type: 'Point', coordinates: [0, 0] })).toBeUndefined();
  });
});

describe('parseBuilding', () => {
  it('maps short keys to the domain model', () => {
    const building = parseBuilding({
      geometry: square,
      properties: { id: 'way/1', name: 'Biênio', sn: 'Bi', kind: 'university', h: 12, mh: 0, acc: 'p', src: 'curated' },
    });
    expect(building).toMatchObject({
      id: 'way/1',
      name: 'Biênio',
      shortName: 'Bi',
      kind: 'university',
      height: 12,
      minHeight: 0,
      access: { status: 'partial', source: 'curated' },
    });
  });

  it('defaults missing optional values', () => {
    const building = parseBuilding({ geometry: square, properties: { id: 'way/2', h: 6, mh: 0 } });
    expect(building).toMatchObject({ kind: 'yes', access: { status: 'unknown', source: 'osm' } });
    expect(building?.name).toBeUndefined();
  });

  it('rejects features without an id or properties', () => {
    expect(parseBuilding({ geometry: square, properties: null })).toBeUndefined();
    expect(parseBuilding({ geometry: square, properties: { h: 3 } })).toBeUndefined();
  });
});
