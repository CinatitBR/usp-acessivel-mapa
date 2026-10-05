/** Free space kept around the building, in pixels. */
const FIT_PADDING = 28;
const EARTH_METERS = 40_075_016.686;
const TILE_PIXELS = 512;

/** The zoom at which a box of `size` metres just fits a view of `view` pixels, looking straight down at `latitude`. */
export function zoomToFit([width, depth]: [number, number], [viewWidth, viewHeight]: [number, number], latitude: number): number {
  const pixelsPerMeter = Math.min((viewWidth - 2 * FIT_PADDING) / width, (viewHeight - 2 * FIT_PADDING) / depth);
  return Math.log2((pixelsPerMeter * EARTH_METERS * Math.cos((latitude * Math.PI) / 180)) / TILE_PIXELS);
}
