import { describe, expect, it } from 'vitest';
import { decodeTrees, encodeTrees, type Tree } from './trees';

const origin: [number, number] = [-46.7283, -23.5611];
const trees: Tree[] = [
  { position: [-46.7301234, -23.5598765], height: 9.4, seed: 17 },
  { position: [-46.7150001, -23.5700002], height: 14, seed: 255 },
];

describe('trees.json encoding', () => {
  const file = encodeTrees(trees, origin);

  it('stores four integers per tree', () => {
    expect(file.t).toHaveLength(8);
    expect(file.t.every(Number.isInteger)).toBe(true);
    expect(file.origin).toEqual(origin);
  });

  it('round-trips positions to within 10 cm, and heights and seeds exactly', () => {
    const decoded = decodeTrees(file);
    decoded.forEach((tree, index) => {
      // 1e-6° is about 0.1 m.
      expect(Math.abs(tree.position[0] - trees[index]!.position[0])).toBeLessThan(1e-6);
      expect(Math.abs(tree.position[1] - trees[index]!.position[1])).toBeLessThan(1e-6);
      expect(tree.height).toBe(trees[index]!.height);
      expect(tree.seed).toBe(trees[index]!.seed);
    });
  });

  it('ignores a truncated tail', () => {
    expect(decodeTrees({ origin, t: [1, 2, 3, 4, 5, 6] })).toHaveLength(1);
    expect(decodeTrees({ origin, t: [] })).toEqual([]);
  });
});
