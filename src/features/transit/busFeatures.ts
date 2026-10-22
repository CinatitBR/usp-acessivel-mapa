import type { Feature, FeatureCollection, Point } from 'geojson';
import type { BusPose } from './busTracker';

export type BusFeatures = FeatureCollection<Point, { id: string; color: string; line: string }>;

export const NO_BUSES: BusFeatures = { type: 'FeatureCollection', features: [] };

/** The flat markers' source data: one point per bus. */
export function busFeatures(poses: BusPose[]): BusFeatures {
  return {
    type: 'FeatureCollection',
    features: poses.map(
      (pose): Feature<Point, { id: string; color: string; line: string }> => ({
        type: 'Feature',
        properties: { id: pose.id, color: pose.color, line: pose.lineId.split('-')[0]! },
        geometry: { type: 'Point', coordinates: pose.position },
      }),
    ),
  };
}

/** About a metre in degrees: closer than this, a marker would not visibly move. */
const SAME_PLACE = 1e-5;

/**
 * True when drawing `next` would show what `previous` already shows: the same buses, each
 * within about a metre. Every `setData` re-tiles the source in a worker, so parked and
 * stopped buses should not cost one.
 */
export function sameBusFeatures(previous: BusFeatures, next: BusFeatures): boolean {
  if (previous.features.length !== next.features.length) return false;
  return previous.features.every((before, index) => {
    const after = next.features[index]!;
    const [x0, y0] = before.geometry.coordinates as [number, number];
    const [x1, y1] = after.geometry.coordinates as [number, number];
    return (
      before.properties.id === after.properties.id &&
      before.properties.color === after.properties.color &&
      Math.abs(x0 - x1) < SAME_PLACE &&
      Math.abs(y0 - y1) < SAME_PLACE
    );
  });
}
