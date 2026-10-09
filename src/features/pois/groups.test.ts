import { describe, expect, it } from 'vitest';
import type { Poi, PoiCategory } from '../../domain/types';
import { GROUP_COUNTS, groupByBuilding } from './groups';

const poi = (id: string, category: PoiCategory, buildingId?: string, position: [number, number] = [0, 0]): Poi => ({
  id, category, buildingId, position, access: { status: 'unknown', source: 'osm' },
});

describe('groupByBuilding', () => {
  it('makes one badge for a building with two or more visible places', () => {
    const groups = groupByBuilding(
      [poi('a', 'food', 'b1', [2, 10]), poi('b', 'water', 'b1', [4, 20]), poi('c', 'food', 'b2'), poi('d', 'food')],
      ['food', 'water'],
    );
    expect(groups.memberIds).toEqual(['a', 'b']);
    expect(groups.badges.features).toHaveLength(1);
    expect(groups.badges.features[0]!.properties).toEqual({ id: 'b1', count: 2, label: '2' });
    expect(groups.badges.features[0]!.geometry.coordinates).toEqual([3, 15]);
  });

  it('counts only the categories that are switched on', () => {
    const pois = [poi('a', 'food', 'b1'), poi('b', 'water', 'b1'), poi('c', 'bank', 'b1')];
    expect(groupByBuilding(pois, ['food']).badges.features).toHaveLength(0);
    expect(groupByBuilding(pois, ['food', 'bank']).memberIds).toEqual(['a', 'c']);
  });

  it('labels a crowded building with one of the drawn counts', () => {
    const pois = Array.from({ length: 12 }, (_, index) => poi(`p${index}`, 'food', 'b1'));
    const label = groupByBuilding(pois, ['food']).badges.features[0]!.properties.label;
    expect(label).toBe('9+');
    expect(GROUP_COUNTS).toContain(label);
  });
});
