/**
 * The few tokens of tokens.css that are drawn on the map. MapLibre paints and canvas icons
 * cannot read CSS custom properties, so they are repeated here; tokens.test.ts fails if the
 * two files disagree.
 */
export const PALETTE = {
  primary200: '#c3d9ff',
  primary500: '#1e5ae8',
  primary600: '#1b4acd',
  primary800: '#1f2d73',
  neutral0: '#ffffff',
  neutral800: '#262626',
  neutral900: '#171717',
} as const;

/** The route line, the pin of a selected place and the outline of a selected room. */
export const MAP_ACCENT = PALETTE.primary600;
export const MAP_ROUTE = PALETTE.primary500;
/** Names the app writes on the map, over a white halo. */
export const MAP_TEXT = PALETTE.neutral900;
export const MAP_HALO = PALETTE.neutral0;
