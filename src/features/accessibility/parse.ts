import type { Geometry } from 'geojson';
import { type AccessCode, decodeAccess } from '../../domain/access';
import { geometryCenter } from '../../domain/geo';
import type { AccessFeatureKind, AccessibilityFeature, DataSource } from '../../domain/types';
import { optionalString } from '../buildings/parse';

export const ACCESS_KINDS: readonly AccessFeatureKind[] = [
  'ramp', 'elevator', 'entrance', 'toilet', 'parking', 'kerb', 'steps',
];

export const isAccessKind = (value: unknown): value is AccessFeatureKind =>
  (ACCESS_KINDS as readonly unknown[]).includes(value);

/** Property schema of public/data/accessibility.geojson, written by scripts/build-campus.ts. */
export type AccessFeatureProperties = {
  id: string;
  kind: AccessFeatureKind;
  acc: AccessCode;
  /** Id of the building it belongs to. */
  bld?: string;
  /** Floor. */
  lvl?: string;
  note?: string;
  /** ISO date of the last on-site check. */
  chk?: string;
  src: DataSource;
};

export function parseAccessFeature(feature: {
  properties: Record<string, unknown> | null;
  geometry: Geometry;
}): AccessibilityFeature | undefined {
  const properties = feature.properties;
  const position = geometryCenter(feature.geometry);
  if (!properties || typeof properties.id !== 'string' || !isAccessKind(properties.kind) || !position) {
    return undefined;
  }
  return {
    id: properties.id,
    kind: properties.kind,
    status: decodeAccess(properties.acc),
    position,
    buildingId: optionalString(properties.bld),
    level: optionalString(properties.lvl),
    note: optionalString(properties.note),
    checked: optionalString(properties.chk),
    source: properties.src === 'curated' ? 'curated' : 'osm',
  };
}
