import { describe, expect, it } from 'vitest';
import { buildingHeights, buildingProperties, parseMeters, poiProperties, roundGeometry } from './normalize';

describe('parseMeters', () => {
  it('reads plain and suffixed metric values', () => {
    expect(parseMeters('12')).toBe(12);
    expect(parseMeters('12.5 m')).toBe(12.5);
    expect(parseMeters('12,5')).toBe(12.5);
  });

  it('ignores other units, zero and junk', () => {
    expect(parseMeters("40'")).toBeUndefined();
    expect(parseMeters('0')).toBeUndefined();
    expect(parseMeters('alto')).toBeUndefined();
    expect(parseMeters(undefined)).toBeUndefined();
  });
});

describe('buildingHeights', () => {
  it('prefers the height tag over levels', () => {
    expect(buildingHeights({ building: 'yes', height: '20', 'building:levels': '2' })).toEqual({ h: 20, mh: 0 });
  });

  it('falls back to levels, then to a default', () => {
    expect(buildingHeights({ building: 'yes', 'building:levels': '3' })).toEqual({ h: 9.6, mh: 0 });
    expect(buildingHeights({ building: 'yes' })).toEqual({ h: 6, mh: 0 });
  });

  it('floats roofs as a thin slab', () => {
    expect(buildingHeights({ building: 'roof' })).toEqual({ h: 4, mh: 3.4 });
    expect(buildingHeights({ building: 'roof', height: '8' })).toEqual({ h: 8, mh: 7.4 });
  });

  it('uses a tagged base and drops one that is not below the top', () => {
    expect(buildingHeights({ building: 'yes', height: '10', min_height: '4' })).toEqual({ h: 10, mh: 4 });
    expect(buildingHeights({ building: 'yes', height: '10', min_height: '12' })).toEqual({ h: 10, mh: 0 });
  });
});

describe('buildingProperties', () => {
  it('keeps only the whitelisted properties', () => {
    expect(
      buildingProperties('way/1', {
        building: 'university',
        name: ' Biênio ',
        short_name: 'Bi',
        wheelchair: 'limited',
        'addr:street': 'Av. Prof. Luciano Gualberto',
      }),
    ).toEqual({ id: 'way/1', name: 'Biênio', sn: 'Bi', kind: 'university', h: 6, mh: 0, acc: 'p', src: 'osm' });
  });

  it('omits empty names and a short name equal to the name', () => {
    const properties = buildingProperties('way/2', { building: 'yes', name: 'CEPE', short_name: 'CEPE' });
    expect(properties).not.toHaveProperty('sn');
    expect(buildingProperties('way/3', { building: 'yes' })).not.toHaveProperty('name');
  });

  it('records the containing institute', () => {
    expect(buildingProperties('way/4', { building: 'yes' }, 'way/9').inst).toBe('way/9');
    expect(buildingProperties('way/4', { building: 'yes' })).not.toHaveProperty('inst');
  });
});

describe('poiProperties', () => {
  it('keeps name, category, access, building and opening hours', () => {
    expect(
      poiProperties('node/5', { amenity: 'restaurant', name: 'Bandejão Central', wheelchair: 'yes', opening_hours: 'Mo-Fr 11:00-14:00' }, 'food', 'way/1'),
    ).toEqual({ id: 'node/5', name: 'Bandejão Central', cat: 'food', acc: 'y', bld: 'way/1', oh: 'Mo-Fr 11:00-14:00', src: 'osm' });
  });

  it('omits what is missing', () => {
    expect(poiProperties('node/6', { amenity: 'toilets' }, 'toilets')).toEqual({ id: 'node/6', cat: 'toilets', acc: 'u', src: 'osm' });
  });
});

describe('roundGeometry', () => {
  it('rounds nested coordinates', () => {
    const rounded = roundGeometry({
      type: 'Polygon',
      coordinates: [[[-46.73012345678, -23.56098765432], [-46.72, -23.56], [-46.73012345678, -23.56098765432]]],
    });
    expect(rounded.coordinates[0]?.[0]).toEqual([-46.730123, -23.560988]);
  });
});
