import type { Map as MapLibreMap } from 'maplibre-gl';
import type { LngLat } from '../../domain/types';

/** Room kept around a framed path. The top and the right keep it clear of the search box and the map buttons. */
const PADDING = { top: 120, right: 70, bottom: 50, left: 40 };
const MAX_ZOOM = 18;
/** MapLibre's own fit assumes a camera that looks straight down; this many corrections bring a tilted one home. */
const CORRECTIONS = 5;
const TOLERANCE_PX = 2;

/**
 * Moves the camera so that the whole path shows. MapLibre fits bounds as if the map were seen
 * from above; tilted, what is near the camera is drawn larger and can fall off the screen. So the
 * fit is tried out first, without drawing: the camera jumps there, the path is measured on the
 * screen and the camera corrected, then it goes back and flies to where the path really fits.
 */
export function framePath(map: MapLibreMap, path: readonly LngLat[]): void {
  if (path.length === 0) return;
  let [west, south] = path[0]!;
  let [east, north] = [west, south];
  for (const [lng, lat] of path) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const fit = map.cameraForBounds([west, south, east, north], { padding: PADDING, maxZoom: MAX_ZOOM });
  if (!fit?.center || fit.zoom === undefined) return;

  const before = { center: map.getCenter(), zoom: map.getZoom() };
  map.jumpTo({ center: fit.center, zoom: fit.zoom });

  const { clientWidth, clientHeight } = map.getContainer();
  // The map's own padding is the part of it that the sheet covers.
  const own = map.getPadding();
  const box = {
    left: (own.left ?? 0) + PADDING.left,
    right: clientWidth - (own.right ?? 0) - PADDING.right,
    top: (own.top ?? 0) + PADDING.top,
    bottom: clientHeight - (own.bottom ?? 0) - PADDING.bottom,
  };
  for (let round = 0; round < CORRECTIONS && box.right > box.left && box.bottom > box.top; round++) {
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const position of path) {
      const { x, y } = map.project(position);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    const inside = left >= box.left - TOLERANCE_PX && right <= box.right + TOLERANCE_PX && top >= box.top - TOLERANCE_PX && bottom <= box.bottom + TOLERANCE_PX;
    if (inside) break;
    // Smaller if the path is larger than the box, and moved so that the two share a middle.
    const scale = Math.max((right - left) / (box.right - box.left), (bottom - top) / (box.bottom - box.top), 1);
    const middle = map.project(map.getCenter());
    const center = map.unproject([middle.x + (left + right - box.left - box.right) / 2, middle.y + (top + bottom - box.top - box.bottom) / 2]);
    map.jumpTo({ center, zoom: map.getZoom() - Math.log2(scale) });
  }

  const target = { center: map.getCenter(), zoom: map.getZoom() };
  map.jumpTo(before);
  map.flyTo(target);
}
