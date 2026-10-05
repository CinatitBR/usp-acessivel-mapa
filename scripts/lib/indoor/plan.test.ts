import { describe, expect, it } from 'vitest';
import { buildIndoorPlan, type IndoorSource } from './plan';

/** A 100 × 50 m box at the equator whose x axis points east and whose y axis points south, like a plan with north up. */
const DEGREE = 1 / 111_320;
const source: IndoorSource = {
  building: 'way/1',
  credit: 'Planta: teste',
  defaultLevel: 0,
  size: [100, 50],
  corners: [[0, 0], [100 * DEGREE, 0], [100 * DEGREE, -50 * DEGREE], [0, -50 * DEGREE]],
  sheets: [
    { level: 1, name: 'Cima', elevations: '+3 m' },
    { level: 0, name: 'Térreo', elevations: '0 m', floor: [10, 10, 60, 40] },
  ],
};
const walls = { unit: 'cm' as const, levels: { '0': [0, 0, 10000, 0], '1': [0, 0, 0, 5000, 5000, 2500, 10000, 2500] } };

describe('buildIndoorPlan', () => {
  const plan = buildIndoorPlan(source, walls);

  it('lists the floors from the lowest up', () => {
    expect(plan.levels).toEqual([
      { id: 0, name: 'Térreo', elevations: '0 m' },
      { id: 1, name: 'Cima', elevations: '+3 m' },
    ]);
    expect(plan.defaultLevel).toBe(0);
  });

  it('places the camera: middle of the box, plan upright', () => {
    expect(plan.center[0]).toBeCloseTo(50 * DEGREE, 6);
    expect(plan.center[1]).toBeCloseTo(-25 * DEGREE, 6);
    expect(plan.size).toEqual([100, 50]);
    expect(plan.bearing).toBe(0);
  });

  it('turns wall lines into map coordinates, one feature per floor', () => {
    const [ground, upper] = plan.walls.features;
    expect(ground!.properties.level).toBe(0);
    expect(ground!.geometry.coordinates).toHaveLength(1);
    expect(ground!.geometry.coordinates[0]![1]![0]).toBeCloseTo(100 * DEGREE, 6);
    expect(upper!.geometry.coordinates).toHaveLength(2);
    // y grows downwards on the plan, so southwards here.
    expect(upper!.geometry.coordinates[0]![1]![1]).toBeCloseTo(-50 * DEGREE, 6);
  });

  it('draws the slab of a smaller floor, and the whole box otherwise', () => {
    const [ground, upper] = plan.slabs.features;
    expect(ground!.geometry.coordinates[0]![0]![0]).toBeCloseTo(10 * DEGREE, 6);
    expect(upper!.geometry.coordinates[0]![2]![0]).toBeCloseTo(100 * DEGREE, 6);
    expect(upper!.geometry.coordinates[0]).toHaveLength(5);
  });

  it('gives the bearing of a turned building', () => {
    // x towards the south: the plan's up is then east.
    const turned = buildIndoorPlan({ ...source, corners: [[0, 0], [0, -100 * DEGREE], [-50 * DEGREE, -100 * DEGREE], [-50 * DEGREE, 0]] }, walls);
    expect(turned.bearing).toBe(90);
  });

  it('refuses a missing floor and an unknown default', () => {
    expect(() => buildIndoorPlan(source, { unit: 'cm', levels: { '0': [0, 0, 1, 1] } })).toThrow(/level 1/);
    expect(() => buildIndoorPlan({ ...source, defaultLevel: 5 }, walls)).toThrow(/Default level/);
  });
});
