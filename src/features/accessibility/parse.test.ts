import { describe, expect, it } from 'vitest';
import { parseAccessFeature } from './parse';

const point = { type: 'Point' as const, coordinates: [-46.73, -23.56] };

describe('parseAccessFeature', () => {
  it('maps short keys to the domain model', () => {
    expect(
      parseAccessFeature({
        geometry: point,
        properties: {
          id: 'curated/elevator-1', kind: 'elevator', acc: 'y', bld: 'way/1', lvl: '0-3',
          note: 'Ao lado da biblioteca', chk: '2026-10-10', src: 'curated',
        },
      }),
    ).toEqual({
      id: 'curated/elevator-1',
      kind: 'elevator',
      status: 'yes',
      position: [-46.73, -23.56],
      buildingId: 'way/1',
      level: '0-3',
      note: 'Ao lado da biblioteca',
      checked: '2026-10-10',
      source: 'curated',
    });
  });

  it('defaults status and source', () => {
    expect(parseAccessFeature({ geometry: point, properties: { id: 'node/1', kind: 'kerb' } })).toMatchObject({
      status: 'unknown',
      source: 'osm',
    });
  });

  it('rejects unknown kinds and malformed features', () => {
    expect(parseAccessFeature({ geometry: point, properties: { id: 'node/2', kind: 'bench' } })).toBeUndefined();
    expect(parseAccessFeature({ geometry: point, properties: { kind: 'ramp' } })).toBeUndefined();
    expect(parseAccessFeature({ geometry: point, properties: null })).toBeUndefined();
  });
});
