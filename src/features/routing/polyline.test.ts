import { describe, expect, it } from 'vitest';
import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
  it('decodes the reference example at precision 5', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it('decodes a Valhalla shape at precision 6', () => {
    const points = decodePolyline('~y_}k@nl_cxAmJzVcSzh@');
    expect(points).toHaveLength(3);
    expect(points[0]![0]).toBeCloseTo(-46.7274, 3);
    expect(points[0]![1]).toBeCloseTo(-23.5606, 3);
  });

  it('returns nothing for an empty string and stops at a truncated one', () => {
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline('_p~iF~ps|U_ulL', 5)).toEqual([[-120.2, 38.5]]);
  });
});
