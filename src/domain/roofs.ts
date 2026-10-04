import type { AccessCode } from './access';
import type { LngLat } from './types';

/**
 * One mesh of public/data/roofs.json, written by scripts/build-campus.ts: the
 * roof of a building, or one colour of a monument standing on a POI.
 */
export type RoofEntry = {
  /** Id of the building, or of the POI, it stands on. */
  id: string;
  /** Where the mesh's origin is on the map. */
  at: LngLat;
  /** Height of the eave above the ground, in metres. */
  base: number;
  /** Colour, as `#rrggbb`. */
  c: string;
  /** Accessibility of the building or POI, so the mesh can follow the accessibility view. */
  acc: AccessCode;
  /** Triangles as east, north, up triples from `at` and `base`, in decimetres. */
  p: number[];
};

export type RoofsFile = { roofs: RoofEntry[] };

export const ROOF_UNIT_METERS = 0.1;
