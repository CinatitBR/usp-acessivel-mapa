import { describe, expect, it } from 'vitest';
import { lightFromStyle } from './lighting';

describe('lightFromStyle', () => {
  it('points straight up for polar 0', () => {
    const { direction } = lightFromStyle({ position: [1.5, 90, 0] });
    expect(direction[0]).toBeCloseTo(0);
    expect(direction[1]).toBeCloseTo(1);
    expect(direction[2]).toBeCloseTo(0);
  });

  it('reads azimuth clockwise from north', () => {
    const east = lightFromStyle({ position: [1, 90, 90] }).direction;
    expect(east[0]).toBeCloseTo(1);
    expect(east[2]).toBeCloseTo(0);
    const south = lightFromStyle({ position: [1, 180, 90] }).direction;
    expect(south[2]).toBeCloseTo(-1);
  });

  it('matches the campus style: light from the south-west, 40° from vertical', () => {
    const { direction, color } = lightFromStyle({ anchor: 'map', position: [1.5, 210, 40], color: '#ffffff', intensity: 0.45 } as never);
    expect(direction[0]).toBeLessThan(0);
    expect(direction[2]).toBeLessThan(0);
    expect(direction[1]).toBeCloseTo(Math.cos((40 * Math.PI) / 180));
    expect(Math.hypot(...direction)).toBeCloseTo(1);
    expect(color).toBe('#ffffff');
  });

  it('gives more directional and less ambient light as intensity rises', () => {
    const soft = lightFromStyle({ intensity: 0.2 });
    const hard = lightFromStyle({ intensity: 0.8 });
    expect(hard.directional).toBeGreaterThan(soft.directional);
    expect(hard.ambient).toBeLessThan(soft.ambient);
  });

  it('falls back to MapLibre defaults for a missing or expression-based light', () => {
    const fallback = lightFromStyle(undefined);
    expect(lightFromStyle({ position: ['interpolate'], intensity: ['zoom'] })).toEqual(fallback);
    expect(fallback.direction[1]).toBeCloseTo(Math.cos((30 * Math.PI) / 180));
  });
});
