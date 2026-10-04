import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { parseBuilding } from './parse';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [[[-46.73, -23.56], [-46.72, -23.56], [-46.72, -23.55], [-46.73, -23.55], [-46.73, -23.56]]],
};

describe('parseBuilding', () => {
  it('maps short keys to the domain model', () => {
    const building = parseBuilding({
      geometry: square,
      properties: {
        id: 'way/1', name: 'Biênio', sn: 'Bi', inst: 'way/9', kind: 'university', h: 12, mh: 0, acc: 'p', src: 'curated',
      },
    });
    expect(building).toMatchObject({
      id: 'way/1',
      name: 'Biênio',
      shortName: 'Bi',
      institute: 'way/9',
      kind: 'university',
      height: 12,
      minHeight: 0,
      access: { status: 'partial', source: 'curated' },
    });
    expect(building?.center[0]).toBeCloseTo(-46.725);
  });

  it('defaults missing optional values', () => {
    const building = parseBuilding({ geometry: square, properties: { id: 'way/2', h: 6, mh: 0 } });
    expect(building).toMatchObject({ kind: 'yes', access: { status: 'unknown', source: 'osm' } });
    expect(building?.name).toBeUndefined();
    expect(building?.institute).toBeUndefined();
  });

  it('rejects features without an id or properties', () => {
    expect(parseBuilding({ geometry: square, properties: null })).toBeUndefined();
    expect(parseBuilding({ geometry: square, properties: { h: 3 } })).toBeUndefined();
  });
});
