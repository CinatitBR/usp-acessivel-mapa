import { Mesh, type Xy } from './roofs';

/**
 * A piece of a monument. Sizes are width (across the front), depth (front to
 * back) and height, in metres; `z` is the height of its foot above the ground
 * and `at` its centre, as metres to the right and to the front of the monument's
 * position.
 */
export type LandmarkPart = {
  /** A block with a flat top. */
  box?: [width: number, depth: number, height: number];
  /** A block that tapers to a point. `lean` moves the point towards the front, as a share of the depth. */
  pyramid?: [width: number, depth: number, height: number];
  lean?: number;
  z?: number;
  at?: [right: number, front: number];
  colour: string;
};

/** An entry of data/overlay/landmarks.json: a monument standing on a POI. */
export type Landmark = {
  /** Id of the POI it stands on. */
  id: string;
  /** Compass bearing the front faces, in degrees. */
  rotation?: number;
  parts: LandmarkPart[];
  note?: string;
};

/**
 * The triangles of a monument, by colour, as x (east), y (north), z (up)
 * triples in metres from its position. Bottom faces are left out.
 */
export function buildLandmark({ rotation = 0, parts }: Landmark): Map<string, number[]> {
  const angle = (rotation * Math.PI) / 180;
  const front: Xy = [Math.sin(angle), Math.cos(angle)];
  const right: Xy = [Math.cos(angle), -Math.sin(angle)];
  const place = (x: number, y: number): Xy => [x * right[0] + y * front[0], x * right[1] + y * front[1]];

  const meshes = new Map<string, Mesh>();
  for (const part of parts) {
    const size = part.box ?? part.pyramid;
    if (!size) continue;
    const [width, depth, height] = size;
    const [cx, cy] = part.at ?? [0, 0];
    const foot = part.z ?? 0;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => place(cx + (sx! * width) / 2, cy + (sy! * depth) / 2));
    const mesh = meshes.get(part.colour) ?? new Mesh();
    meshes.set(part.colour, mesh);

    if (part.box) {
      corners.forEach((corner, index) => mesh.wall(corner, corners[(index + 1) % 4]!, foot, foot + height, foot, foot + height));
      mesh.add([...corners[0]!, foot + height], [...corners[1]!, foot + height], [...corners[2]!, foot + height]);
      mesh.add([...corners[0]!, foot + height], [...corners[2]!, foot + height], [...corners[3]!, foot + height]);
    } else {
      const tip = place(cx, cy + (part.lean ?? 0) * depth);
      corners.forEach((corner, index) => mesh.add([...corner, foot], [...corners[(index + 1) % 4]!, foot], [...tip, foot + height]));
    }
  }
  return new Map([...meshes].map(([colour, mesh]) => [colour, mesh.triangles.flat()]));
}
