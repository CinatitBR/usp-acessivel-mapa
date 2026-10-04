import { describe, expect, it } from 'vitest';
import { buildLandmark } from './landmarks';

const points = (triangles: number[]) =>
  Array.from({ length: triangles.length / 3 }, (_, index) => triangles.slice(index * 3, index * 3 + 3) as [number, number, number]);

describe('buildLandmark', () => {
  it('builds a box as four walls and a top, without a bottom', () => {
    const mesh = buildLandmark({ id: 'node/1', parts: [{ box: [4, 2, 3], z: 1, colour: '#aaaaaa' }] });
    const box = points(mesh.get('#aaaaaa')!);
    expect(box).toHaveLength(10 * 3);
    expect(Math.min(...box.map((point) => point[2]))).toBe(1);
    expect(Math.max(...box.map((point) => point[2]))).toBe(4);
    // Width runs east–west and depth north–south while the front faces north.
    expect(Math.max(...box.map((point) => point[0]))).toBeCloseTo(2);
    expect(Math.max(...box.map((point) => point[1]))).toBeCloseTo(1);
  });

  it('turns the front to the given bearing', () => {
    const mesh = buildLandmark({ id: 'node/1', rotation: 90, parts: [{ box: [4, 2, 3], at: [0, 10], colour: '#aaaaaa' }] });
    const box = points(mesh.get('#aaaaaa')!);
    // Facing east: "10 m to the front" is 10 m east, and the 4 m width now runs north–south.
    expect(Math.min(...box.map((point) => point[0]))).toBeCloseTo(9);
    expect(Math.max(...box.map((point) => point[0]))).toBeCloseTo(11);
    expect(Math.max(...box.map((point) => point[1]))).toBeCloseTo(2);
  });

  it('brings a pyramid to a point, leaning to the front', () => {
    const mesh = buildLandmark({ id: 'node/1', parts: [{ pyramid: [2, 4, 6], lean: 0.25, z: 10, colour: '#445544' }] });
    const pyramid = points(mesh.get('#445544')!);
    expect(pyramid).toHaveLength(4 * 3);
    const tips = pyramid.filter((point) => point[2] === 16);
    expect(tips).toHaveLength(4);
    for (const tip of tips) {
      expect(tip[0]).toBeCloseTo(0);
      expect(tip[1]).toBeCloseTo(1);
    }
  });

  it('groups the parts by colour', () => {
    const mesh = buildLandmark({
      id: 'node/1',
      parts: [
        { box: [1, 1, 1], colour: '#aaaaaa' },
        { box: [1, 1, 1], z: 1, colour: '#aaaaaa' },
        { pyramid: [1, 1, 1], z: 2, colour: '#445544' },
        { colour: '#000000' },
      ],
    });
    expect([...mesh.keys()]).toEqual(['#aaaaaa', '#445544']);
    expect(mesh.get('#aaaaaa')).toHaveLength(2 * 10 * 9);
  });
});
