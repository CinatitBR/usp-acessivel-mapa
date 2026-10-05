import { describe, expect, it } from 'vitest';
import { zoomToFit } from './camera';

/** Metres across one pixel at a zoom and latitude, on 512-pixel tiles. */
const metersPerPixel = (zoom: number, latitude: number) => (40_075_016.686 * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);

describe('zoomToFit', () => {
  it('fits the width on a narrow view and the depth on a low one', () => {
    const narrow = zoomToFit([110, 66], [390, 460], -23.56);
    expect(110 / metersPerPixel(narrow, -23.56)).toBeCloseTo(390 - 56);
    const low = zoomToFit([110, 66], [1400, 300], -23.56);
    expect(66 / metersPerPixel(low, -23.56)).toBeCloseTo(300 - 56);
  });

  it('zooms in one level when the view doubles', () => {
    const small = zoomToFit([100, 100], [256, 256], 0);
    const large = zoomToFit([100, 100], [456, 456], 0);
    expect(large - small).toBeCloseTo(1);
  });
});
