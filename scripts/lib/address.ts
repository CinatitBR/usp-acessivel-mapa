import type { LngLat } from '../../src/domain/types';
import type { OsmTags } from './normalize';

/** The parts of a Nominatim `address` object the app uses. */
export type NominatimAddress = { road?: string; house_number?: string; postcode?: string };

const clean = (value: string | undefined) => value?.trim() || undefined;

/**
 * One-line street address, e.g. `Rua do Lago, 876 · 05508-080`. The building's
 * own `addr:*` tags win over Nominatim's answer, and that over the nearest
 * named street.
 */
export function formatAddress(tags: OsmTags, nominatim: NominatimAddress | undefined, nearbyRoad?: string): string | undefined {
  const street = clean(tags['addr:street']) ?? clean(nominatim?.road) ?? clean(nearbyRoad);
  if (!street) return undefined;
  const number = clean(tags['addr:housenumber']) ?? clean(nominatim?.house_number);
  const postcode = clean(tags['addr:postcode']) ?? clean(nominatim?.postcode);
  return [number ? `${street}, ${number}` : street, postcode].filter(Boolean).join(' · ');
}

export type NamedRoad = { name: string; line: LngLat[] };

const METERS_PER_DEGREE = 111_195;

/**
 * Name of the named street closest to a point, within `maxMeters`. Nominatim
 * does not index unnamed buildings, so for most of the campus this is where
 * the street comes from.
 */
export function nearestRoad(point: LngLat, roads: NamedRoad[], maxMeters: number): string | undefined {
  const scale = Math.cos((point[1] * Math.PI) / 180);
  const toXy = ([lng, lat]: LngLat) => [(lng - point[0]) * scale * METERS_PER_DEGREE, (lat - point[1]) * METERS_PER_DEGREE] as const;
  let best: { name: string; distance: number } | undefined;
  for (const road of roads) {
    for (let index = 0; index < road.line.length - 1; index += 1) {
      const [ax, ay] = toXy(road.line[index]!);
      const [bx, by] = toXy(road.line[index + 1]!);
      const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
      // The point is the origin, so its projection on the segment is at parameter t.
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / lengthSquared));
      const distance = Math.hypot(ax + t * (bx - ax), ay + t * (by - ay));
      if (distance <= maxMeters && (!best || distance < best.distance)) best = { name: road.name, distance };
    }
  }
  return best?.name;
}

/**
 * What the app needs to find the object's Portuguese Wikipedia article: the
 * article title when OSM names it, otherwise the Wikidata id (`Q123`), which
 * the app resolves when the panel opens.
 */
export function wikiRef(tags: OsmTags): string | undefined {
  const [, language, title] = /^(?:([a-z-]+):)?(.+)$/.exec(clean(tags.wikipedia) ?? '') ?? [];
  if (title && (language ?? 'pt') === 'pt') return title.trim().replaceAll('_', ' ');
  const wikidata = clean(tags.wikidata);
  return wikidata && /^Q\d+$/.test(wikidata) ? wikidata : undefined;
}

/** The object's website, only when it is a plain web link. */
export function website(tags: OsmTags): string | undefined {
  const value = clean(tags.website) ?? clean(tags['contact:website']);
  if (!value) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
