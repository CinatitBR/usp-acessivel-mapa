/** The heights a sheet rests at on a phone: its header only, about half the screen, and almost all of it. */
export const SNAPS = ['collapsed', 'half', 'full'] as const;
export type Snap = (typeof SNAPS)[number];
export type SnapHeights = Record<Snap, number>;

/** Share of the screen the sheet takes at rest. */
const HALF_SHARE = 0.45;
/** Kept free above a full sheet, in pixels: the search box stays in reach. */
const TOP_GAP = 88;
/** A release faster than this, in pixels per millisecond, is a flick: the sheet goes on in that direction. */
const FLICK_SPEED = 0.4;
/** The map is never asked to make room for more than this share of the screen. */
const MAX_COVER_SHARE = 0.6;

/**
 * Heights of the three rests for a screen `viewport` pixels tall. `grip` is the height of the
 * handle and header, `content` that of the whole sheet; a short sheet is never taller than its content.
 */
export function snapHeights(viewport: number, grip: number, content: number): SnapHeights {
  const half = Math.min(content, Math.round(viewport * HALF_SHARE));
  return { collapsed: Math.min(grip, half), half, full: Math.max(half, Math.min(content, viewport - TOP_GAP)) };
}

/** Where a sheet released at `height` comes to rest. `velocity` is in pixels per millisecond, positive while it grows. */
export function settle(heights: SnapHeights, height: number, velocity: number): Snap {
  if (velocity >= FLICK_SPEED) return SNAPS.find((snap) => heights[snap] > height + 1) ?? 'full';
  if (velocity <= -FLICK_SPEED) return SNAPS.findLast((snap) => heights[snap] < height - 1) ?? 'collapsed';
  // The nearest rest; the taller one when it is a tie.
  return SNAPS.reduce((best, snap) => (Math.abs(heights[snap] - height) <= Math.abs(heights[best] - height) ? snap : best));
}

/** The next rest above (`1`) or below (`-1`) that has a different height; the same one when there is none. */
export function step(heights: SnapHeights, snap: Snap, direction: 1 | -1): Snap {
  const order = direction === 1 ? SNAPS : SNAPS.toReversed();
  return order.slice(order.indexOf(snap) + 1).find((candidate) => heights[candidate] !== heights[snap]) ?? snap;
}

/** How much of the map counts as covered by a sheet of this height, for the camera and the controls that sit above it. */
export const coverOf = (height: number, viewport: number) => Math.min(height, Math.round(viewport * MAX_COVER_SHARE));
