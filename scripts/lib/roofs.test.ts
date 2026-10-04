import { describe, expect, it } from 'vitest';
import { buildRoof, defaultHeight, LANTERN_METERS, longAxis, roofSpec, roofTop, standsOnTop, type Xy } from './roofs';

/** 20 m east–west by 10 m north–south. */
const RECTANGLE: Xy[] = [[0, 0], [20, 0], [20, 10], [0, 10]];
const L_SHAPE: Xy[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 30], [0, 30]];

const points = (triangles: number[]) =>
  Array.from({ length: triangles.length / 3 }, (_, index) => triangles.slice(index * 3, index * 3 + 3) as [number, number, number]);

/** Area of the roof seen from above. A roof that covers its footprint once has the footprint's area. */
function planArea(triangles: number[]): number {
  const all = points(triangles);
  let area = 0;
  for (let index = 0; index < all.length; index += 3) {
    const [a, b, c] = [all[index]!, all[index + 1]!, all[index + 2]!];
    area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  }
  return area;
}

describe('roofSpec', () => {
  it('gives no roof for flat, unknown or missing shapes', () => {
    expect(roofSpec({})).toBeUndefined();
    expect(roofSpec({ 'roof:shape': 'flat' })).toBeUndefined();
    expect(roofSpec({ 'roof:shape': 'mansard' })).toBeUndefined();
  });

  it('reads OSM roof tags', () => {
    expect(roofSpec({ 'roof:shape': 'gabled', 'roof:height': '3,5', 'roof:colour': '#AA5533', 'roof:orientation': 'across' })).toEqual({
      shape: 'gabled',
      height: 3.5,
      colour: '#aa5533',
      ridgeAcross: true,
    });
  });

  it('turns roof:direction, which points down the slope, into a ridge and a high side', () => {
    expect(roofSpec({ 'roof:shape': 'skillion', 'roof:direction': '90' })).toEqual({ shape: 'skillion', ridge: 180, rise: 270 });
  });

  it('lets the overlay win field by field, and draws hipped as gabled', () => {
    expect(roofSpec({ 'roof:shape': 'hipped', 'roof:height': '2', 'roof:direction': '90' }, { height: 5, direction: 30 })).toEqual({
      shape: 'gabled',
      height: 5,
      ridge: 30,
    });
    expect(roofSpec({ 'roof:shape': 'flat' }, { shape: 'dome', colour: 'red' })).toEqual({ shape: 'dome' });
  });
});

describe('longAxis', () => {
  it('finds the long side of a rectangle, whatever its rotation', () => {
    expect(longAxis(RECTANGLE)).toMatchObject({ length: 20, width: 10 });
    const turned = RECTANGLE.map(([x, y]): Xy => [x * 0.6 - y * 0.8, x * 0.8 + y * 0.6]);
    const { axis, length, width } = longAxis(turned);
    expect(length).toBeCloseTo(20);
    expect(width).toBeCloseTo(10);
    expect(Math.abs(axis[0])).toBeCloseTo(0.6);
    expect(Math.abs(axis[1])).toBeCloseTo(0.8);
  });
});

describe('buildRoof', () => {
  it('puts the ridge of a gabled roof along the long side, at the given height', () => {
    const roof = buildRoof([RECTANGLE], { shape: 'gabled', height: 4 });
    expect(roofTop(roof)).toBeCloseTo(4);
    const ridge = points(roof).filter((point) => Math.abs(point[2] - 4) < 1e-6);
    expect(ridge.every((point) => Math.abs(point[1] - 5) < 1e-6)).toBe(true);
    expect(Math.min(...ridge.map((point) => point[0]))).toBeCloseTo(0);
    expect(Math.max(...ridge.map((point) => point[0]))).toBeCloseTo(20);
  });

  it('closes the gable ends', () => {
    const roof = buildRoof([RECTANGLE], { shape: 'gabled', height: 4 });
    // Two slopes cover the footprint once; the two gables are vertical and add nothing seen from above.
    expect(planArea(roof)).toBeCloseTo(200);
    const western = points(roof).filter((point) => Math.abs(point[0]) < 1e-6);
    expect(western.some((point) => Math.abs(point[2] - 4) < 1e-6)).toBe(true);
    expect(roof.length / 9).toBeGreaterThan(4);
  });

  it('stands two gabled bays side by side', () => {
    const roof = points(buildRoof([RECTANGLE], { shape: 'gabled', height: 2, bays: 2 }));
    const ridges = new Set(roof.filter((point) => Math.abs(point[2] - 2) < 1e-6).map((point) => point[1].toFixed(3)));
    expect([...ridges].sort()).toEqual(['2.500', '7.500']);
    // The valley between the bays comes back down to the eave.
    expect(roof.some((point) => Math.abs(point[1] - 5) < 1e-6 && point[0] > 1 && point[0] < 19 && point[2] === 0)).toBe(true);
    expect(planArea(buildRoof([RECTANGLE], { shape: 'gabled', height: 2, bays: 2 }))).toBeCloseTo(200);
    expect(roofSpec({}, { shape: 'gabled', bays: 2 })).toEqual({ shape: 'gabled', bays: 2 });
    expect(roofSpec({}, { shape: 'round', bays: 2 })).toEqual({ shape: 'round' });
  });

  it('follows a ridge bearing', () => {
    const roof = buildRoof([RECTANGLE], { shape: 'gabled', height: 4, ridge: 0 });
    const ridge = points(roof).filter((point) => Math.abs(point[2] - 4) < 1e-6);
    expect(ridge.every((point) => Math.abs(point[0] - 10) < 1e-6)).toBe(true);
  });

  it('raises a skillion towards its high side', () => {
    const roof = points(buildRoof([RECTANGLE], { shape: 'skillion', height: 2, rise: 90 }));
    for (const [x, , z] of roof.filter((point) => point[2] > 1e-6)) expect(z).toBeLessThanOrEqual((x / 20) * 2 + 1e-6);
    expect(Math.max(...roof.filter((point) => Math.abs(point[0] - 20) < 1e-6).map((point) => point[2]))).toBeCloseTo(2);
  });

  it('builds a barrel vault that peaks in the middle', () => {
    const roof = buildRoof([RECTANGLE], { shape: 'round', height: 3 });
    expect(roofTop(roof)).toBeCloseTo(3);
    expect(planArea(roof)).toBeCloseTo(200);
  });

  it('builds one tooth every 7 m or so, each with a vertical face', () => {
    const roof = buildRoof([[[0, 0], [20, 0], [20, 21], [0, 21]]], { shape: 'sawtooth', height: 2, rise: 0 });
    expect(roofTop(roof)).toBeCloseTo(2);
    expect(planArea(roof)).toBeCloseTo(420);
    // Faces between teeth stand at y = 7 and y = 14, and the last one on the outline at y = 21.
    for (const y of [7, 14, 21]) {
      expect(points(roof).filter((point) => Math.abs(point[1] - y) < 1e-6 && Math.abs(point[2] - 2) < 1e-6).length).toBeGreaterThan(0);
    }
  });

  it('brings a pyramid to a point over the middle', () => {
    const roof = points(buildRoof([RECTANGLE], { shape: 'pyramidal', height: 5 }));
    expect(roof).toHaveLength(4 * 3);
    expect(roof.filter((point) => point[2] === 5).every((point) => point[0] === 10 && point[1] === 5)).toBe(true);
  });

  it('builds a dome as tall as half its width by default', () => {
    const square: Xy[] = [[0, 0], [12, 0], [12, 12], [0, 12]];
    expect(roofTop(buildRoof([square], { shape: 'dome' }))).toBeCloseTo(6);
    expect(defaultHeight('dome', 12)).toBe(6);
  });

  it('stands a round dome of a given diameter in the middle of the building', () => {
    const roof = points(buildRoof([RECTANGLE], { shape: 'dome', diameter: 6 }));
    expect(Math.max(...roof.map((point) => point[2]))).toBeCloseTo(3);
    for (const [x, y] of roof) expect(Math.hypot(x - 10, y - 5)).toBeLessThanOrEqual(3 + 1e-6);
    expect(roofSpec({}, { shape: 'gabled', diameter: 6 })).toEqual({ shape: 'gabled' });
  });

  it('builds a rim and a grid of skylights for a coffered roof', () => {
    const fau: Xy[] = [[0, 0], [110, 0], [110, 66], [0, 66]];
    const roof = points(buildRoof([fau], { shape: 'coffered' }));
    const tips = roof.filter((point) => Math.abs(point[2] - 2.5 * 0.85) < 1e-6);
    // One tip per face of each pyramid: 10 × 6 skylights of about 11 m.
    expect(tips).toHaveLength(10 * 6 * 4);
    expect(Math.max(...roof.map((point) => point[2]))).toBeCloseTo(2.5);
    for (const [x, y] of roof) {
      expect(x).toBeGreaterThanOrEqual(-1e-6);
      expect(x).toBeLessThanOrEqual(110 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(66 + 1e-6);
    }
    // The rim goes all the way round: every side of the outline carries a wall up to the rim's height.
    for (const side of [(p: number[]) => p[0] === 0, (p: number[]) => p[0] === 110, (p: number[]) => p[1] === 0, (p: number[]) => p[1] === 66]) {
      expect(roof.filter((point) => side(point) && Math.abs(point[2] - 2.5) < 1e-6).length).toBeGreaterThan(1);
    }

    const turned = fau.map(([x, y]): Xy => [x * 0.6 - y * 0.8, x * 0.8 + y * 0.6]);
    expect(buildRoof([turned], { shape: 'coffered' })).toHaveLength(roof.length * 3);
    expect(points(buildRoof([fau], { shape: 'coffered', cell: 5.5 })).filter((point) => Math.abs(point[2] - 2.5 * 0.85) < 1e-6)).toHaveLength(20 * 12 * 4);
    // A box mapped a little out of square keeps all its skylights.
    const skewed: Xy[] = [[0, 0], [110, 1.5], [109, 67], [-1, 66]];
    expect(points(buildRoof([skewed], { shape: 'coffered' })).filter((point) => Math.abs(point[2] - 2.5 * 0.85) < 1e-6)).toHaveLength(10 * 6 * 4);
    // Without a rim nothing rises above the skylights, and the grid starts on the outline.
    const bare = points(buildRoof([fau], { shape: 'coffered', rim: false }));
    expect(Math.max(...bare.map((point) => point[2]))).toBeCloseTo(2.5 * 0.85);
    expect(Math.min(...bare.map((point) => point[0]))).toBeCloseTo(0);

    // A stepped outline keeps exactly the cells inside it: a 40 × 30 block with a 20 × 10 corner cut out, in 10 m cells.
    const stepped: Xy[] = [[0, 0], [40, 0], [40, 20], [20, 20], [20, 30], [0, 30]];
    const cells = points(buildRoof([stepped], { shape: 'coffered', rim: false, cell: 10 })).filter((point) => Math.abs(point[2] - 2.5 * 0.85) < 1e-6);
    expect(cells).toHaveLength((12 - 2) * 4);
    expect(cells.some((point) => point[0] > 20 && point[1] > 20)).toBe(false);
    expect(standsOnTop({ shape: 'coffered' })).toBe(true);
    expect(standsOnTop({ shape: 'dome' })).toBe(false);
  });

  it('stands a lantern where a cone would come to its point', () => {
    const round: Xy[] = Array.from({ length: 24 }, (_, side): Xy => [Math.cos((side / 24) * Math.PI * 2) * 24, Math.sin((side / 24) * Math.PI * 2) * 24]);
    const plain = points(buildRoof([round], { shape: 'pyramidal', height: 2.5 }));
    expect(plain).toHaveLength(24 * 3);
    expect(Math.max(...plain.map((point) => point[2]))).toBeCloseTo(2.5);

    const roof = points(buildRoof([round], { shape: 'pyramidal', height: 2.5, lantern: 9 }));
    // The cone stops 4.5 m from the middle, at 2.5 × (1 − 4.5 / 24), and the lantern adds 2 m.
    const foot = 2.5 * (1 - 4.5 / 24);
    expect(Math.max(...roof.map((point) => point[2]))).toBeCloseTo(foot + LANTERN_METERS);
    expect(roof.filter((point) => Math.abs(point[2] - (foot + LANTERN_METERS)) < 1e-6).every((point) => Math.hypot(point[0], point[1]) < 1e-6)).toBe(true);
    for (const [x, y] of roof) expect(Math.hypot(x, y)).toBeLessThanOrEqual(24 + 1e-6);
    // Nothing of the cone is left inside the lantern.
    expect(roof.filter((point) => Math.hypot(point[0], point[1]) < 4.4 && point[2] < foot - 0.31)).toHaveLength(0);
    expect(roofSpec({}, { shape: 'gabled', lantern: 9 })).toEqual({ shape: 'gabled' });
  });

  it('covers an L-shaped footprint exactly once', () => {
    for (const shape of ['gabled', 'round', 'skillion', 'sawtooth'] as const) {
      expect(planArea(buildRoof([L_SHAPE], { shape, height: 3 }))).toBeCloseTo(400);
    }
  });

  it('leaves a courtyard open', () => {
    const courtyard: Xy[] = [[5, 3], [15, 3], [15, 7], [5, 7]];
    expect(planArea(buildRoof([RECTANGLE, courtyard], { shape: 'gabled', height: 3 }))).toBeCloseTo(200 - 40);
  });

  it('accepts closed rings and gives the same roof every time', () => {
    const closed = [...RECTANGLE, RECTANGLE[0]!];
    const roof = buildRoof([closed], { shape: 'round' });
    expect(roof).toEqual(buildRoof([RECTANGLE], { shape: 'round' }));
    expect(buildRoof([[[0, 0], [1, 1]]], { shape: 'gabled' })).toEqual([]);
  });
});
