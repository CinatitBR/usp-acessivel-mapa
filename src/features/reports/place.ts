import type { MapGeoJSONFeature } from 'maplibre-gl';
import { CAMPUS_BBOX } from '../../config';
import type { ReportPlace } from '../../domain/reports';
import type { LngLat } from '../../domain/types';
import { strings } from '../../strings/pt-BR';
import { isAccessKind } from '../accessibility/parse';

export const onCampus = ([lng, lat]: LngLat) => {
  const [west, south, east, north] = CAMPUS_BBOX;
  return lng >= west && lng <= east && lat >= south && lat <= north;
};

/**
 * What a report made by tapping the map is about: the accessibility point or the building
 * under the finger, or else that spot on a path. `feature` is what the tap hit, if anything;
 * `building` tells whether it is a building.
 */
export function placeAt(tapped: LngLat, feature?: Pick<MapGeoJSONFeature, 'geometry' | 'properties'>, building = false): ReportPlace {
  const id: unknown = feature?.properties.id;
  const name: unknown = feature?.properties.name;
  const kind: unknown = feature?.properties.kind;
  if (!feature || typeof id !== 'string') return { position: tapped, label: strings.reports.mapPoint, on: 'path' };
  if (building) {
    return { position: tapped, label: typeof name === 'string' && name ? name : strings.building.unnamed, on: 'building', target: id };
  }
  // An accessibility point: the report sits on the point itself, not where the finger landed.
  const position = feature.geometry.type === 'Point' ? (feature.geometry.coordinates as LngLat) : tapped;
  if (!isAccessKind(kind)) return { position, label: strings.reports.mapPoint, on: 'path' };
  return { position, label: strings.access.kinds[kind], on: kind === 'elevator' || kind === 'toilet' ? kind : 'path', target: id };
}
