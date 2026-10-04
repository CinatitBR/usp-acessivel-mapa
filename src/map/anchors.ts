import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Empty layers in public/styles/campus.json. Every app layer is inserted with
 * `beforeId` set to one of these, never to a basemap layer id, so the basemap
 * can be replaced without touching app code.
 */
export const ANCHORS = {
  /** Above land use and water, below roads: campus area fills. */
  campusAreas: 'anchor-campus-areas',
  /** Above roads and basemap buildings, below labels: lines and flat features. */
  features: 'anchor-features',
  /** Building extrusions and the Three.js custom layer. */
  scene3d: 'anchor-3d',
  /** Top of the stack: app symbols and labels. */
  labels: 'anchor-labels',
} as const;

export type AnchorId = (typeof ANCHORS)[keyof typeof ANCHORS];

export function missingAnchors(map: Pick<MaplibreMap, 'getLayer'>): AnchorId[] {
  return Object.values(ANCHORS).filter((id) => !map.getLayer(id));
}
