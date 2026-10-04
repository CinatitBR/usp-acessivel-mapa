import { describe, expect, it } from 'vitest';
import { type CampusRecord, mergeOverlay, type OverlayFeature } from './mergeOverlay';

const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] });

const records: CampusRecord[] = [
  { id: 'way/1', tags: { building: 'university', name: 'Bloco A', wheelchair: 'no' }, geometry: point(-46.73, -23.56) },
  { id: 'node/2', tags: { amenity: 'toilets' }, geometry: point(-46.731, -23.561) },
];

const overlay = (properties: Record<string, unknown>, geometry: OverlayFeature['geometry'] = null): OverlayFeature => ({
  type: 'Feature',
  geometry,
  properties,
});

const find = (result: { records: CampusRecord[] }, id: string) => result.records.find((record) => record.id === id);

describe('mergeOverlay', () => {
  it('patches tags of an existing object and marks it curated', () => {
    const result = mergeOverlay(records, [
      overlay({ osm: 'way/1', name: 'Bloco A – Ala Norte', wheelchair: 'limited', elevator: true, 'capacity:disabled': 2 }),
    ]);
    expect(find(result, 'way/1')).toEqual({
      id: 'way/1',
      tags: {
        building: 'university', name: 'Bloco A – Ala Norte', wheelchair: 'limited', elevator: 'yes', 'capacity:disabled': '2',
      },
      geometry: point(-46.73, -23.56),
      curated: true,
    });
    expect(find(result, 'node/2')?.curated).toBeUndefined();
  });

  it('removes a tag with null and keeps the others', () => {
    const result = mergeOverlay(records, [overlay({ osm: 'way/1', wheelchair: null })]);
    expect(find(result, 'way/1')?.tags).toEqual({ building: 'university', name: 'Bloco A' });
  });

  it('replaces the geometry only when the overlay gives one', () => {
    const moved = mergeOverlay(records, [overlay({ osm: 'node/2' }, point(-46.74, -23.57))]);
    expect(find(moved, 'node/2')?.geometry).toEqual(point(-46.74, -23.57));
  });

  it('deletes an object', () => {
    const result = mergeOverlay(records, [overlay({ osm: 'node/2', delete: true })]);
    expect(find(result, 'node/2')).toBeUndefined();
    expect(result.records).toHaveLength(1);
  });

  it('adds a new object with a stable curated id', () => {
    const feature = overlay({ kind: 'elevator', wheelchair: 'yes', building_id: 'way/1' }, point(-46.7305, -23.5605));
    const first = mergeOverlay(records, [feature]);
    const second = mergeOverlay(records, [feature]);
    const added = first.records.find((record) => record.id.startsWith('curated/elevator-'));
    expect(added).toMatchObject({ tags: { kind: 'elevator', wheelchair: 'yes', building_id: 'way/1' }, curated: true });
    expect(second.records.map((record) => record.id)).toContain(added!.id);
  });

  it('reports unknown osm ids instead of silently ignoring them', () => {
    const result = mergeOverlay(records, [overlay({ osm: 'way/999', name: 'Não existe' })]);
    expect(result.unmatched).toEqual(['way/999']);
    expect(result.records).toHaveLength(2);
  });

  it('reports new features without geometry and duplicates', () => {
    const feature = overlay({ kind: 'ramp' }, point(-46.73, -23.56));
    const result = mergeOverlay(records, [overlay({ kind: 'ramp' }), feature, feature]);
    expect(result.invalid).toHaveLength(2);
    expect(result.records).toHaveLength(3);
  });

  it('does not mutate its input', () => {
    mergeOverlay(records, [overlay({ osm: 'way/1', name: 'Outro' })]);
    expect(records[0]?.tags.name).toBe('Bloco A');
  });
});
