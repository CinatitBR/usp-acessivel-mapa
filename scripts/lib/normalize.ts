import type { Geometry, Position } from 'geojson';
import { deriveAccessStatus, encodeAccess } from '../../src/domain/access';
import type { BuildingProperties } from '../../src/features/buildings/parse';

export type OsmTags = Record<string, string>;

const LEVEL_HEIGHT = 3.2;
const DEFAULT_HEIGHT = 6;
const DEFAULT_ROOF_HEIGHT = 4;
const ROOF_THICKNESS = 0.6;
const MAX_HEIGHT = 150;

/** Parses OSM length values such as `12`, `12.5 m` or `12,5`. Non-metric units are ignored. */
export function parseMeters(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(m|metros?)?\s*$/i.exec(value);
  if (!match?.[1]) return undefined;
  const meters = Number(match[1].replace(',', '.'));
  return Number.isFinite(meters) && meters > 0 ? meters : undefined;
}

function parseLevels(value: string | undefined): number | undefined {
  const levels = Number(value?.replace(',', '.'));
  return Number.isFinite(levels) && levels > 0 ? levels : undefined;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Height and base height in metres. Order of preference: explicit `height`,
 * then `building:levels`, then a default. Roofs float as a thin slab unless
 * OSM gives a base.
 */
export function buildingHeights(tags: OsmTags): { h: number; mh: number } {
  const isRoof = tags.building === 'roof';
  const levels = parseLevels(tags['building:levels']);
  const height = Math.min(
    MAX_HEIGHT,
    parseMeters(tags.height)
      ?? (levels ? levels * LEVEL_HEIGHT : undefined)
      ?? (isRoof ? DEFAULT_ROOF_HEIGHT : DEFAULT_HEIGHT),
  );

  const minLevel = parseLevels(tags['building:min_level']);
  const taggedBase = parseMeters(tags.min_height) ?? (minLevel ? minLevel * LEVEL_HEIGHT : undefined);
  const base = taggedBase ?? (isRoof ? height - ROOF_THICKNESS : 0);

  return { h: round1(height), mh: round1(base < height ? Math.max(0, base) : 0) };
}

const clean = (value: string | undefined) => value?.trim() || undefined;

/** `id` is the OSM-style id, e.g. `way/123`. */
export function buildingProperties(id: string, tags: OsmTags): BuildingProperties {
  const name = clean(tags.name);
  const shortName = clean(tags.short_name);
  return {
    id,
    ...(name && { name }),
    ...(shortName && shortName !== name && { sn: shortName }),
    kind: clean(tags.building) ?? 'yes',
    ...buildingHeights(tags),
    acc: encodeAccess(deriveAccessStatus(tags.wheelchair)),
    src: 'osm',
  };
}

/** Rounds every coordinate; 6 decimals is about 0.1 m at this latitude. */
export function roundGeometry<T extends Geometry>(geometry: T, decimals = 6): T {
  const factor = 10 ** decimals;
  const round = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(round)
      : Math.round((value as number) * factor) / factor;
  if (geometry.type === 'GeometryCollection') return geometry;
  return { ...geometry, coordinates: round(geometry.coordinates) as Position[] };
}
