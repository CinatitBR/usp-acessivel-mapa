import { fitHelmert } from './helmert';
import type { Point } from './svgPaths';

/**
 * Where a building's own axes sit on the map. The building is a box of
 * `size` metres; `corners` are the map positions of its four corners, starting
 * at the box's origin and going along the width first: (0,0), (w,0), (w,d), (0,d).
 */
export type BuildingFrame = { size: [width: number, depth: number]; corners: [Point, Point, Point, Point] };

const METERS_PER_DEGREE = 111_320;

/**
 * Carries a point in metres on the building's axes to [lng, lat]. `residuals` tells how
 * far, in metres, each given corner is from where a true box of that size would put it.
 */
export function buildingToMap({ size: [width, depth], corners }: BuildingFrame): { toLngLat: (point: Point) => Point; residuals: number[] } {
  const lng0 = corners.reduce((sum, [lng]) => sum + lng, 0) / 4;
  const lat0 = corners.reduce((sum, [, lat]) => sum + lat, 0) / 4;
  const perLng = METERS_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180);
  const box: Point[] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  const controls = box.map((from, index) => {
    const [lng, lat] = corners[index]!;
    return { from, to: [(lng - lng0) * perLng, (lat - lat0) * METERS_PER_DEGREE] as Point };
  });
  // Mirrored when the depth axis runs clockwise from the width axis on the map, as on a plan with y down.
  const [a, b, c] = controls.map(({ to }) => to) as [Point, Point, Point];
  const clockwise = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0;
  const fit = fitHelmert(controls, clockwise);
  return {
    toLngLat: (point) => {
      const [x, y] = fit.apply(point);
      return [lng0 + x / perLng, lat0 + y / METERS_PER_DEGREE];
    },
    residuals: fit.residuals,
  };
}
