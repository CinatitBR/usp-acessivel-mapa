import type { Point } from './svgPaths';

export type ControlPoint = { from: Point; to: Point };

export type Helmert = {
  apply: (point: Point) => Point;
  /** Units of `to` per unit of `from`. */
  scale: number;
  /** Counter-clockwise turn, in degrees. */
  rotation: number;
  /** Distance left between each control point and its target, in units of `to`. */
  residuals: number[];
};

/**
 * The best rigid fit (shift, turn and one scale, no shear) that carries the
 * `from` points onto the `to` points, by least squares. Needs two points or more.
 * With `mirror`, the y of `from` is flipped first: for going between a drawing
 * with y down and a map with y up.
 */
export function fitHelmert(controls: readonly ControlPoint[], mirror = false): Helmert {
  if (controls.length < 2) throw new Error('A rigid fit needs at least two control points');
  const flip = mirror ? -1 : 1;
  const source = controls.map(({ from }): Point => [from[0], flip * from[1]]);
  const target = controls.map(({ to }) => to);
  const mean = (points: Point[], axis: 0 | 1) => points.reduce((sum, point) => sum + point[axis], 0) / points.length;
  const [sx, sy, tx, ty] = [mean(source, 0), mean(source, 1), mean(target, 0), mean(target, 1)];

  // to = (a + ib) · from + shift, with points as complex numbers.
  let dot = 0;
  let cross = 0;
  let spread = 0;
  source.forEach(([x, y], index) => {
    const [u, v] = [x - sx, y - sy];
    const [p, q] = [target[index]![0] - tx, target[index]![1] - ty];
    dot += u * p + v * q;
    cross += u * q - v * p;
    spread += u * u + v * v;
  });
  if (spread === 0) throw new Error('The control points all lie on one spot');
  const a = dot / spread;
  const b = cross / spread;

  const apply = ([x, y]: Point): Point => {
    const [u, v] = [x - sx, flip * y - sy];
    return [a * u - b * v + tx, b * u + a * v + ty];
  };
  return {
    apply,
    scale: Math.hypot(a, b),
    rotation: (Math.atan2(b, a) * 180) / Math.PI,
    residuals: controls.map(({ from, to }) => {
      const [x, y] = apply(from);
      return Math.hypot(x - to[0], y - to[1]);
    }),
  };
}
