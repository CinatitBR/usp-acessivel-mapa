import type { FeatureCollection } from 'geojson';
import type { AccessibilityFeature, Building, BusStop, Institute, LineDirection, Poi } from '../domain/types';
import { parseAccessFeature } from '../features/accessibility/parse';
import { parseBuilding } from '../features/buildings/parse';
import { parsePoi } from '../features/pois/parse';
import { parseLineDirection, parseStop } from '../features/transit/parse';

export const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

const cache = new Map<string, Promise<unknown>>();

/**
 * Loads a file from public/data once and keeps the promise, so it can be
 * passed to React's `use()` and shared by search and panels. A failed load is
 * dropped from the cache so the next call retries.
 */
function loadOnce<T>(file: string, convert: (json: unknown) => T): Promise<T> {
  let promise = cache.get(file) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(dataUrl(file))
      .then((response) => {
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(convert);
    promise.catch(() => cache.delete(file));
    cache.set(file, promise);
  }
  return promise;
}

const defined = <T>(value: T | undefined): value is T => value !== undefined;

export const loadBuildings = () =>
  loadOnce('buildings.geojson', (json) =>
    (json as FeatureCollection).features.map(parseBuilding).filter(defined),
  ) satisfies Promise<Building[]>;

export const loadPois = () =>
  loadOnce('pois.geojson', (json) =>
    (json as FeatureCollection).features.map(parsePoi).filter(defined),
  ) satisfies Promise<Poi[]>;

export const loadAccessFeatures = () =>
  loadOnce('accessibility.geojson', (json) =>
    (json as FeatureCollection).features.map(parseAccessFeature).filter(defined),
  ) satisfies Promise<AccessibilityFeature[]>;

export const loadStops = () =>
  loadOnce('stops.geojson', (json) =>
    (json as FeatureCollection).features.map(parseStop).filter(defined),
  ) satisfies Promise<BusStop[]>;

export const loadLines = () =>
  loadOnce('lines.geojson', (json) =>
    (json as FeatureCollection).features.map(parseLineDirection).filter(defined),
  ) satisfies Promise<LineDirection[]>;

/** institutes.json is already in domain shape. */
export const loadInstitutes = () => loadOnce('institutes.json', (json) => json as Institute[]);
