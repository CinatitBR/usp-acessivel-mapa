import type { LngLat } from './types';

export type Tree = {
  position: LngLat;
  /** Metres. */
  height: number;
  /** 0–255, fixed per tree: drives rotation, width and colour so they never change between loads. */
  seed: number;
};

/**
 * public/data/trees.json: integers only, to keep thousands of trees small.
 * `t` is a flat list of [east, north, height, seed] per tree; east and north
 * are decimetres from `origin`, height is decimetres.
 */
export type TreesFile = { origin: LngLat; t: number[] };

const METERS_PER_DEGREE = 111_195;
const FIELDS = 4;

const eastScale = (latitude: number) => METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);

export function encodeTrees(trees: Tree[], origin: LngLat): TreesFile {
  const scale = eastScale(origin[1]);
  return {
    origin,
    t: trees.flatMap((tree) => [
      Math.round((tree.position[0] - origin[0]) * scale * 10),
      Math.round((tree.position[1] - origin[1]) * METERS_PER_DEGREE * 10),
      Math.round(tree.height * 10),
      tree.seed & 0xff,
    ]),
  };
}

export function decodeTrees(file: TreesFile): Tree[] {
  const scale = eastScale(file.origin[1]);
  const trees: Tree[] = [];
  for (let index = 0; index + FIELDS <= file.t.length; index += FIELDS) {
    trees.push({
      position: [
        file.origin[0] + file.t[index]! / 10 / scale,
        file.origin[1] + file.t[index + 1]! / 10 / METERS_PER_DEGREE,
      ],
      height: file.t[index + 2]! / 10,
      seed: file.t[index + 3]!,
    });
  }
  return trees;
}
