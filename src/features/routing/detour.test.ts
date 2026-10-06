import { describe, expect, it, vi } from 'vitest';
import type { Report } from '../../domain/reports';
import type { LngLat, Route } from '../../domain/types';
import { findDetour, isBlocking } from './detour';

const M_LAT = 1 / 111_320;
const M_LNG = M_LAT / Math.cos((-23.56 * Math.PI) / 180);
const at = (east: number, north: number): LngLat => [-46.73 + east * M_LNG, -23.56 + north * M_LAT];
const route = (geometry: LngLat[], distance: number): Route => ({ provider: 'ors', profile: 'wheelchair', stepFree: 'guaranteed', geometry, distance, duration: distance, steps: [] });
const report = (id: string, position: LngLat): Report => ({ id, type: 'blocked', answer: 'no', position, since: '2026-10-05' });

/** Straight east for 200 m; around to the north; around further north. */
const USUAL = route([at(0, 0), at(200, 0)], 200);
const NORTH = route([at(0, 0), at(0, 50), at(200, 50), at(200, 0)], 300);
const FAR_NORTH = route([at(0, 0), at(0, 100), at(200, 100), at(200, 0)], 400);

describe('isBlocking', () => {
  it('is a passage, step or sidewalk that cannot be passed', () => {
    expect(isBlocking(report('a', at(0, 0)))).toBe(true);
    expect(isBlocking({ ...report('a', at(0, 0)), type: 'step' })).toBe(true);
    expect(isBlocking({ ...report('a', at(0, 0)), answer: 'help' })).toBe(false);
    expect(isBlocking({ ...report('a', at(0, 0)), type: 'elevator', answer: 'broken' })).toBe(false);
  });
});

describe('findDetour', () => {
  it('asks for nothing when no report is on the route', async () => {
    const ask = vi.fn();
    expect(await findDetour(USUAL, [report('away', at(100, 40))], ask)).toEqual({ route: USUAL });
    expect(ask).not.toHaveBeenCalled();
  });

  it('goes around a report and says what it costs', async () => {
    const ask = vi.fn().mockResolvedValue(NORTH);
    expect(await findDetour(USUAL, [report('b', at(100, 3))], ask)).toEqual({ route: NORTH, detour: { avoided: 1, extra: 100 } });
    expect(ask).toHaveBeenCalledWith(['b']);
  });

  it('goes around a second report met on the way around, then stops', async () => {
    const ask = vi.fn().mockResolvedValueOnce(NORTH).mockResolvedValueOnce(FAR_NORTH);
    const result = await findDetour(USUAL, [report('b', at(100, 0)), report('a', at(100, 50))], ask);
    expect(ask).toHaveBeenNthCalledWith(2, ['a', 'b']);
    expect(result).toEqual({ route: FAR_NORTH, detour: { avoided: 2, extra: 200 } });
  });

  it('gives the usual route, marked, when there is no way around', async () => {
    const ask = vi.fn().mockRejectedValue(new Error('HTTP 404'));
    expect(await findDetour(USUAL, [report('b', at(100, 0))], ask)).toEqual({ route: USUAL, noDetour: true });
  });

  it('gives the usual route when going around changes nothing', async () => {
    // The pin is 10 m from the path: it warns, but the area kept out of does not reach the path.
    const ask = vi.fn().mockResolvedValue(USUAL);
    expect(await findDetour(USUAL, [report('b', at(100, 10))], ask)).toEqual({ route: USUAL });
  });

  it('lets a cancelled request through as such', async () => {
    const ask = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(findDetour(USUAL, [report('b', at(100, 0))], ask)).rejects.toThrow('aborted');
  });
});
