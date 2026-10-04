import { CAMPUS_BBOX, CAMPUS_CENTER } from '../../config';
import { bboxContains } from '../../domain/geo';
import type { GeocodeResult } from '../../domain/types';
import { fetchJson } from '../../lib/http';

const ENDPOINT = 'https://photon.komoot.io/api/';
/** Greater São Paulo: [west, south, east, north]. */
const SEARCH_BBOX = [-46.83, -23.8, -46.36, -23.35];
const LIMIT = 5;

export const PHOTON_MIN_CHARS = 3;
export const PHOTON_DEBOUNCE_MS = 350;

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/**
 * Converts a Photon response to results. Places inside the campus bounding box
 * are dropped: the local index is the authority there, and this section is
 * labelled "fora do campus".
 */
export function parsePhoton(json: unknown): GeocodeResult[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];

  const results: GeocodeResult[] = [];
  // Long streets come back once per segment; one entry is enough.
  const seen = new Set<string>();
  for (const feature of features) {
    const coordinates = feature.geometry?.coordinates;
    const properties = feature.properties ?? {};
    if (!Array.isArray(coordinates)) continue;
    const [lng, lat] = coordinates as unknown[];
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    if (bboxContains([...CAMPUS_BBOX], [lng, lat])) continue;

    const street = [text(properties.street), text(properties.housenumber)].filter(Boolean).join(', ');
    const label = text(properties.name) ?? (street || undefined);
    if (!label) continue;

    const detail = [label === street ? undefined : street, text(properties.district), text(properties.city)]
      .filter(Boolean)
      .join(' · ');
    const key = `${label}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: `photon/${String(properties.osm_type ?? '')}${String(properties.osm_id ?? `${lng},${lat}`)}`,
      label,
      detail: detail || undefined,
      position: [lng, lat],
      source: 'photon',
    });
  }
  return results;
}

export async function searchPhoton(query: string, signal: AbortSignal): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(CAMPUS_CENTER.latitude),
    lon: String(CAMPUS_CENTER.longitude),
    bbox: SEARCH_BBOX.join(','),
    limit: String(LIMIT),
  });
  return parsePhoton(await fetchJson(`${ENDPOINT}?${params}`, { provider: 'photon', signal, timeoutMs: 8_000 }));
}
