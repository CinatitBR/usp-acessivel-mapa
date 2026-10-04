import type { PoiCategory } from '../../domain/types';
import { DEFAULT_POI_CATEGORIES, POI_CATEGORIES } from './style';

const STORAGE_KEY = 'usp-map:pois';

/** Reads a stored list of visible categories; anything unreadable gives the defaults. */
export function parsePoiCategories(stored: string | null): readonly PoiCategory[] {
  if (stored === null) return DEFAULT_POI_CATEGORIES;
  try {
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value)) return DEFAULT_POI_CATEGORIES;
    // Filtering the known list drops categories that no longer exist and keeps menu order.
    return POI_CATEGORIES.filter((category) => value.includes(category));
  } catch {
    return DEFAULT_POI_CATEGORIES;
  }
}

export function togglePoiCategory(visible: readonly PoiCategory[], category: PoiCategory): readonly PoiCategory[] {
  return POI_CATEGORIES.filter((other) => (other === category) !== visible.includes(other));
}

export function readPoiCategories(): readonly PoiCategory[] {
  try {
    return parsePoiCategories(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_POI_CATEGORIES;
  }
}

export function storePoiCategories(visible: readonly PoiCategory[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
  } catch {
    // Private browsing: the choice just lasts for this visit.
  }
}
