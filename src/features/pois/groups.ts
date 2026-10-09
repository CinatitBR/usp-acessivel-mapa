import type { FeatureCollection, Point } from 'geojson';
import type { Poi, PoiCategory } from '../../domain/types';

/** Counts above this are drawn as "9+". */
const MAX_COUNT = 9;
export const GROUP_COUNTS: readonly string[] = [...Array.from({ length: MAX_COUNT - 1 }, (_, index) => String(index + 2)), `${MAX_COUNT}+`];

type GroupProperties = { id: string; count: number; label: string };

export type PoiGroups = {
  /** One point per building that holds two or more visible places, at the centre of those places. */
  badges: FeatureCollection<Point, GroupProperties>;
  /** The places those badges stand for. */
  memberIds: string[];
};

/**
 * Places that share a building pile up on its roof, so until the map is close they are drawn
 * as one badge with their count. Only the categories switched on in the layer menu count.
 */
export function groupByBuilding(pois: readonly Poi[], visible: readonly PoiCategory[]): PoiGroups {
  const byBuilding = new Map<string, Poi[]>();
  for (const poi of pois) {
    if (!poi.buildingId || !visible.includes(poi.category)) continue;
    byBuilding.set(poi.buildingId, [...(byBuilding.get(poi.buildingId) ?? []), poi]);
  }
  const groups = [...byBuilding].filter(([, members]) => members.length > 1);
  return {
    badges: {
      type: 'FeatureCollection',
      features: groups.map(([buildingId, members]) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 1].map((axis) => members.reduce((sum, poi) => sum + poi.position[axis]!, 0) / members.length),
        },
        properties: {
          id: buildingId,
          count: members.length,
          label: members.length > MAX_COUNT ? `${MAX_COUNT}+` : String(members.length),
        },
      })),
    },
    memberIds: groups.flatMap(([, members]) => members.map((poi) => poi.id)),
  };
}
