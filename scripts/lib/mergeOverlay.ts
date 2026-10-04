import type { Feature, Geometry } from 'geojson';
import type { OsmTags } from './normalize';

/** One OSM object (or one object added by the overlay) before normalization. */
export type CampusRecord = {
  /** `way/123`, `node/45`, `relation/6`, or `curated/...` for objects the overlay adds. */
  id: string;
  tags: OsmTags;
  geometry: Geometry;
  /** True when the overlay changed or created the record. */
  curated?: boolean;
};

export type OverlayFeature = Feature<Geometry | null, Record<string, unknown> | null>;

export type MergeResult = {
  records: CampusRecord[];
  /** `osm` ids in the overlay that do not exist in the OSM data. */
  unmatched: string[];
  /** Human-readable problems with overlay features that were skipped. */
  invalid: string[];
};

/** Keys that steer the merge and are not tags. */
const CONTROL_KEYS = new Set(['osm', 'delete']);

/** Tag values are strings, as in OSM; booleans become yes/no. */
function toTagValue(value: unknown): string | undefined {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

function applyTags(tags: OsmTags, properties: Record<string, unknown>): OsmTags {
  const next = { ...tags };
  for (const [key, value] of Object.entries(properties)) {
    if (CONTROL_KEYS.has(key)) continue;
    const tag = value === null ? undefined : toTagValue(value);
    if (tag === undefined) delete next[key];
    else next[key] = tag;
  }
  return next;
}

/** Short stable hash, so an added feature keeps its id while its coordinates stay the same. */
function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return (value >>> 0).toString(36);
}

/**
 * Applies the hand-curated overlay to the OSM records.
 *
 * - A feature with an `osm` id patches that object: its properties override
 *   the OSM tags (`null` removes a tag), and a non-null geometry replaces the
 *   OSM geometry. With `"delete": true` the object is removed instead.
 * - A feature without `osm` is added as a new object and needs a geometry.
 */
export function mergeOverlay(records: CampusRecord[], overlay: OverlayFeature[]): MergeResult {
  const byId = new Map(records.map((record) => [record.id, record]));
  const unmatched: string[] = [];
  const invalid: string[] = [];

  overlay.forEach((feature, index) => {
    const properties = feature.properties ?? {};
    const osmId = properties.osm;

    if (typeof osmId === 'string') {
      const record = byId.get(osmId);
      if (!record) {
        unmatched.push(osmId);
      } else if (properties.delete === true) {
        byId.delete(osmId);
      } else {
        byId.set(osmId, {
          id: osmId,
          tags: applyTags(record.tags, properties),
          geometry: feature.geometry ?? record.geometry,
          curated: true,
        });
      }
      return;
    }

    if (!feature.geometry) {
      invalid.push(`feature #${index + 1} has neither an "osm" id nor a geometry`);
      return;
    }
    const tags = applyTags({}, properties);
    const id = `curated/${tags.kind ?? 'feature'}-${hash(JSON.stringify(feature.geometry))}`;
    if (byId.has(id)) {
      invalid.push(`feature #${index + 1} duplicates ${id}`);
      return;
    }
    byId.set(id, { id, tags, geometry: feature.geometry, curated: true });
  });

  return { records: [...byId.values()], unmatched, invalid };
}
