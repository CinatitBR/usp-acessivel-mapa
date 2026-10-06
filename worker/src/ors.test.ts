import { describe, expect, it } from 'vitest';
import { AVOID_RADIUS_METERS, avoidPolygons } from './ors';

describe('avoidPolygons', () => {
  const centre: [number, number] = [-46.73, -23.56];
  const meters = ([lng, lat]: number[]) => Math.hypot((lng! - centre[0]) * 111_320 * Math.cos((centre[1] * Math.PI) / 180), (lat! - centre[1]) * 111_320);

  it('draws one closed ring of the chosen radius around each point', () => {
    const { type, coordinates } = avoidPolygons([centre, [-46.72, -23.55]]);
    expect(type).toBe('MultiPolygon');
    expect(coordinates).toHaveLength(2);
    const ring = coordinates[0]![0]!;
    expect(ring[0]).toEqual(ring.at(-1));
    expect(ring).toHaveLength(13);
    for (const vertex of ring) expect(meters(vertex)).toBeCloseTo(AVOID_RADIUS_METERS, 0);
  });

  it('takes another radius', () => {
    expect(meters(avoidPolygons([centre], 20).coordinates[0]![0]![3]!)).toBeCloseTo(20, 0);
  });
});
