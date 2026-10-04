import type { PoiCategory } from '../../domain/types';
import type { BadgeShape, Glyph } from '../../map/badgeIcon';

type PoiStyle = {
  color: string;
  /** Squares mark places to leave a vehicle; everything else is a circle. */
  shape: BadgeShape;
  glyph: Glyph;
  /** Shown before the user has chosen anything in the layer menu. */
  onByDefault: boolean;
};

const BIKE: Glyph = {
  stroke: 'M2.5 16a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0z M14.5 16a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0z M6 16l3.5-8H15l3 8 M9.5 8l3.5 8H6 M8 6h3 M15 8l.8-3H18',
};

/**
 * How each category is drawn, in menu order. When icons collide on the map,
 * categories earlier in this list win.
 */
export const POI_STYLES: Record<PoiCategory, PoiStyle> = {
  food: {
    color: '#d9480f', shape: 'circle', onByDefault: true,
    glyph: { path: 'M6 3h1.5v6h1V3H10v6h1V3h1.5v7a2.5 2.5 0 0 1-2 2.4V21h-2.5v-8.6A2.5 2.5 0 0 1 6 10z M18.5 3v18H16v-7h-2c0-5 1.5-9 4.5-11z' },
  },
  library: {
    color: '#5f3dc4', shape: 'circle', onByDefault: true,
    glyph: { path: 'M3 5c3-1 5.5-.6 8 1v14c-2.5-1.6-5-2-8-1z M21 5c-3-1-5.5-.6-8 1v14c2.5-1.6 5-2 8-1z' },
  },
  health: {
    color: '#e03131', shape: 'circle', onByDefault: true,
    glyph: { path: 'M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z' },
  },
  bike_rental: { color: '#c2255c', shape: 'circle', onByDefault: true, glyph: BIKE },
  toilets: { color: '#495057', shape: 'circle', onByDefault: true, glyph: { text: 'WC' } },
  water: {
    color: '#1971c2', shape: 'circle', onByDefault: true,
    glyph: { path: 'M12 2.5c4.5 5.5 7 9 7 12.5a7 7 0 0 1-14 0c0-3.5 2.5-7 7-12.5z' },
  },
  bank: { color: '#2b8a3e', shape: 'circle', onByDefault: true, glyph: { text: '$' } },
  atm: { color: '#2b8a3e', shape: 'circle', onByDefault: true, glyph: { text: '$' } },
  culture: {
    color: '#9c36b5', shape: 'circle', onByDefault: true,
    glyph: { path: 'M12 2.5l9.5 5v2.5h-19V7.5z M4.5 11.5h3v6h-3z M10.5 11.5h3v6h-3z M16.5 11.5h3v6h-3z M2.5 19h19v2.5h-19z' },
  },
  info: { color: '#1971c2', shape: 'circle', onByDefault: true, glyph: { text: 'i' } },
  shop: {
    color: '#e67700', shape: 'circle', onByDefault: true,
    glyph: { path: 'M4.5 8h15l1 13.5h-17z M8.5 8V7a3.5 3.5 0 0 1 7 0v1h-2V7a1.5 1.5 0 0 0-3 0v1z' },
  },
  sport: {
    color: '#0c8599', shape: 'circle', onByDefault: false,
    glyph: { stroke: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z M3.5 12h17 M12 3.5c-4.5 4.5-4.5 12.5 0 17 M12 3.5c4.5 4.5 4.5 12.5 0 17' },
  },
  park: {
    color: '#2f9e44', shape: 'circle', onByDefault: false,
    glyph: { path: 'M12 2.5l6 8.5h-3l4.5 6.5h-6V21.5h-3V17.5h-6L9 11H6z' },
  },
  bike_parking: { color: '#c2255c', shape: 'square', onByDefault: false, glyph: BIKE },
  parking: { color: '#1c7ed6', shape: 'square', onByDefault: false, glyph: { text: 'P' } },
  other: {
    color: '#868e96', shape: 'circle', onByDefault: false,
    glyph: { path: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z' },
  },
};

export const POI_CATEGORIES = Object.keys(POI_STYLES) as PoiCategory[];

export const DEFAULT_POI_CATEGORIES: readonly PoiCategory[] = POI_CATEGORIES.filter(
  (category) => POI_STYLES[category].onByDefault,
);
