import earcut from 'earcut';
import type { OsmTags } from './normalize';

/** A point in metres: x east, y north. */
export type Xy = [x: number, y: number];
/** A point of a roof in metres: x east, y north, z above the eave. */
type Xyz = [x: number, y: number, z: number];

export const ROOF_SHAPES = ['gabled', 'skillion', 'round', 'sawtooth', 'pyramidal', 'dome', 'coffered'] as const;
export type RoofShape = (typeof ROOF_SHAPES)[number];

export type RoofSpec = {
  shape: RoofShape;
  /** Height of the roof above the eave, in metres. A default by shape and size when absent. */
  height?: number;
  /** Compass bearing of the ridge line, in degrees. The long side of the footprint when absent. */
  ridge?: number;
  /** Compass bearing towards the high side (skillion, sawtooth). Wins over `ridge`. */
  rise?: number;
  /** The ridge runs along the short side of the footprint (OSM `roof:orientation=across`). */
  ridgeAcross?: boolean;
  colour?: string;
  /**
   * Dome and pyramid only: the roof is a round one of this diameter, in metres, standing in the
   * middle of the flat top instead of covering the whole building.
   */
  diameter?: number;
  /** Dome and pyramid only: a small raised skylight of this diameter, in metres, where the roof would come to its top. */
  lantern?: number;
  /** Coffered only: the size of one skylight, in metres. */
  cell?: number;
  /** Coffered only: `false` leaves out the rim around the grid. */
  rim?: boolean;
  /** Gabled only: how many pitched roofs stand side by side (2 is an M profile). */
  bays?: number;
};

/** An entry of data/overlay/roofs.json. `direction` is the bearing of the ridge line. */
export type RoofOverlay = { shape?: string; height?: number; direction?: number; rise?: number; colour?: string; diameter?: number; lantern?: number; cell?: number; rim?: boolean; bays?: number; note?: string };

const isShape = (value: string | undefined): value is RoofShape => (ROOF_SHAPES as readonly string[]).includes(value ?? '');
const number = (value: string | undefined) => {
  const parsed = Number.parseFloat(value?.replace(',', '.') ?? '');
  return Number.isFinite(parsed) ? parsed : undefined;
};
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The roof of a building from its OSM tags and its overlay entry; the overlay
 * wins field by field. Flat and unknown shapes give no roof. A hipped roof is
 * drawn gabled.
 */
export function roofSpec(tags: OsmTags, overlay: RoofOverlay = {}): RoofSpec | undefined {
  const tagged = overlay.shape ?? tags['roof:shape'];
  const shape = tagged === 'hipped' ? 'gabled' : tagged;
  if (!isShape(shape)) return undefined;

  // OSM's roof:direction points down the slope; the ridge runs across it.
  const down = number(tags['roof:direction']);
  const height = overlay.height ?? number(tags['roof:height']);
  const ridge = overlay.direction ?? (down !== undefined ? down + 90 : undefined);
  const rise = overlay.rise ?? (overlay.direction === undefined && down !== undefined ? down + 180 : undefined);
  const colour = overlay.colour ?? tags['roof:colour'];
  return {
    shape,
    ...(height !== undefined && height > 0 && { height }),
    ...(ridge !== undefined && { ridge }),
    ...(rise !== undefined && { rise }),
    ...(colour && HEX.test(colour) && { colour: colour.toLowerCase() }),
    ...(tags['roof:orientation'] === 'across' && { ridgeAcross: true }),
    ...(overlay.cell !== undefined && overlay.cell > 0 && shape === 'coffered' && { cell: overlay.cell }),
    ...(overlay.rim === false && shape === 'coffered' && { rim: false }),
    ...(overlay.bays !== undefined && overlay.bays > 1 && shape === 'gabled' && { bays: Math.round(overlay.bays) }),
    ...(overlay.lantern !== undefined && overlay.lantern > 0 && (shape === 'dome' || shape === 'pyramidal') && { lantern: overlay.lantern }),
    ...(overlay.diameter !== undefined && overlay.diameter > 0 && (shape === 'dome' || shape === 'pyramidal') && { diameter: overlay.diameter }),
  };
}

const unit = (bearing: number): Xy => [Math.sin((bearing * Math.PI) / 180), Math.cos((bearing * Math.PI) / 180)];
const dot = (a: Xy, b: Xy) => a[0] * b[0] + a[1] * b[1];

/** Unit vector along the long side of the smallest rectangle around the ring, and the rectangle's two sides. */
export function longAxis(ring: Xy[]): { axis: Xy; length: number; width: number } {
  let best = { axis: [1, 0] as Xy, length: 0, width: 0, area: Infinity };
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index]!;
    const b = ring[(index + 1) % ring.length]!;
    const size = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (size < 1e-6) continue;
    const along: Xy = [(b[0] - a[0]) / size, (b[1] - a[1]) / size];
    const across: Xy = [-along[1], along[0]];
    const [u, v] = [ring.map((point) => dot(point, along)), ring.map((point) => dot(point, across))];
    const [du, dv] = [Math.max(...u) - Math.min(...u), Math.max(...v) - Math.min(...v)];
    if (du * dv < best.area - 1e-9) {
      best = du >= dv ? { axis: along, length: du, width: dv, area: du * dv } : { axis: across, length: dv, width: du, area: du * dv };
    }
  }
  return best;
}

/** A band across the roof, between two distances from its low edge, with the roof height at each side. */
type Strip = { u0: number; u1: number; z0: number; z1: number };

const ARC_STEPS = 8;
/** Width of one tooth of a sawtooth roof, in metres. */
const TOOTH_METERS = 7;

function strips(shape: RoofShape, width: number, height: number, bays = 1): Strip[] {
  if (shape === 'skillion') return [{ u0: 0, u1: width, z0: 0, z1: height }];
  if (shape === 'gabled') {
    const bay = width / bays;
    return Array.from({ length: bays }, (_, index) => [
      { u0: index * bay, u1: (index + 0.5) * bay, z0: 0, z1: height },
      { u0: (index + 0.5) * bay, u1: (index + 1) * bay, z0: height, z1: 0 },
    ]).flat();
  }
  if (shape === 'sawtooth') {
    const teeth = Math.max(1, Math.round(width / TOOTH_METERS));
    return Array.from({ length: teeth }, (_, tooth) => ({ u0: (tooth * width) / teeth, u1: ((tooth + 1) * width) / teeth, z0: 0, z1: height }));
  }
  const arc = (step: number) => Math.sin((step / ARC_STEPS) * Math.PI) * height;
  return Array.from({ length: ARC_STEPS }, (_, step) => ({
    u0: (step * width) / ARC_STEPS,
    u1: ((step + 1) * width) / ARC_STEPS,
    z0: arc(step),
    z1: arc(step + 1),
  }));
}

/** Cuts a convex polygon or a segment, given as (u, v) points, to u0 ≤ u ≤ u1. */
function clip(points: Xy[], u0: number, u1: number, closed: boolean): Xy[] {
  let current = points;
  for (const [limit, sign] of [[u0, 1], [u1, -1]] as const) {
    const inside = (point: Xy) => (point[0] - limit) * sign >= -1e-9;
    const next: Xy[] = [];
    const count = closed ? current.length : current.length - 1;
    for (let index = 0; index < count; index++) {
      const a = current[index]!;
      const b = current[(index + 1) % current.length]!;
      if (inside(a)) next.push(a);
      if (inside(a) !== inside(b)) {
        const t = (limit - a[0]) / (b[0] - a[0]);
        next.push([limit, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (!closed && current.length > 0 && inside(current[current.length - 1]!)) next.push(current[current.length - 1]!);
    current = next;
  }
  return current;
}

const EPSILON = 1e-4;

/** Collects triangles, dropping the ones without area. */
export class Mesh {
  readonly triangles: Xyz[] = [];

  add(a: Xyz, b: Xyz, c: Xyz) {
    const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (area > EPSILON) this.triangles.push(a, b, c);
  }

  /** A wall standing on the segment a–b, from `low` to `high` at each end. */
  wall(a: Xy, b: Xy, lowA: number, highA: number, lowB: number, highB: number) {
    this.add([...a, lowA], [...b, lowB], [...b, highB]);
    this.add([...a, lowA], [...b, highB], [...a, highA]);
  }
}

/** Roofs whose height depends only on the distance across the ridge: skillion, gabled, round and sawtooth. */
function profileRoof(rings: Xy[][], shape: RoofShape, height: number | undefined, spec: RoofSpec): Xyz[] {
  const outer = rings[0]!;
  const box = longAxis(outer);
  let across: Xy;
  if (spec.rise !== undefined) across = unit(spec.rise);
  else if (spec.ridge === undefined && spec.ridgeAcross) across = box.axis;
  else {
    const ridge = spec.ridge !== undefined ? unit(spec.ridge) : box.axis;
    across = [-ridge[1], ridge[0]];
  }
  const along: Xy = [across[1], -across[0]];
  const toUv = (point: Xy): Xy => [dot(point, across), dot(point, along)];
  const us = outer.map((point) => dot(point, across));
  const low = Math.min(...us);
  const width = Math.max(...us) - low;
  const fromUv = ([u, v]: Xy): Xy => [(u + low) * across[0] + v * along[0], (u + low) * across[1] + v * along[1]];
  const local = (point: Xy): Xy => {
    const [u, v] = toUv(point);
    return [u - low, v];
  };

  const bays = spec.bays ?? 1;
  const bands = strips(shape, width, height ?? defaultHeight(shape, width / bays), bays);
  const zAt = ({ u0, u1, z0, z1 }: Strip, u: number) => z0 + ((z1 - z0) * (u - u0)) / (u1 - u0);
  const mesh = new Mesh();
  const lift = (band: Strip, point: Xy): Xyz => [...fromUv(point), zAt(band, point[0])];

  // The roof surface: the footprint's triangles, cut into the bands and lifted.
  const flat = rings.flat().flatMap(local);
  const holes = rings.slice(1).map((_, index) => rings.slice(0, index + 1).reduce((sum, ring) => sum + ring.length, 0));
  const triangles = earcut(flat, holes);
  const corner = (index: number): Xy => [flat[index * 2]!, flat[index * 2 + 1]!];
  bands.forEach((band, index) => {
    const next = bands[index + 1];
    for (let offset = 0; offset < triangles.length; offset += 3) {
      const piece = clip([corner(triangles[offset]!), corner(triangles[offset + 1]!), corner(triangles[offset + 2]!)], band.u0, band.u1, true);
      for (let fan = 1; fan + 1 < piece.length; fan++) mesh.add(lift(band, piece[0]!), lift(band, piece[fan]!), lift(band, piece[fan + 1]!));
      // A step between this band and the next one (the glazed face of a sawtooth).
      if (!next || Math.abs(next.z0 - band.z1) < EPSILON) continue;
      const edge = piece.filter((point) => Math.abs(point[0] - band.u1) < 1e-6);
      if (edge.length === 2) mesh.wall(fromUv(edge[0]!), fromUv(edge[1]!), next.z0, band.z1, next.z0, band.z1);
    }
  });

  // The ends: a wall under the roof wherever the outline does not sit on the eave.
  for (const ring of rings) {
    ring.forEach((point, index) => {
      const segment = [local(point), local(ring[(index + 1) % ring.length]!)];
      for (const band of bands) {
        const part = clip(segment, band.u0, band.u1, false);
        if (part.length === 2) mesh.wall(fromUv(part[0]!), fromUv(part[1]!), 0, zAt(band, part[0]![0]), 0, zAt(band, part[1]![0]));
      }
    });
  }
  return mesh.triangles;
}

const DOME_RINGS = 6;
const CIRCLE_SIDES = 20;

const middle = (ring: Xy[]): Xy => [
  ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
  ring.reduce((sum, point) => sum + point[1], 0) / ring.length,
];

const circle = (center: Xy, radius: number, sides = CIRCLE_SIDES): Xy[] =>
  Array.from({ length: sides }, (_, side) => {
    const angle = (side / sides) * Math.PI * 2;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  });

const LANTERN_SIDES = 6;
const LANTERN_DRUM_METERS = 1.2;
const LANTERN_CAP_METERS = 0.8;
/** How far a lantern rises above the roof it stands on. */
export const LANTERN_METERS = LANTERN_DRUM_METERS + LANTERN_CAP_METERS;

/**
 * Roofs that rise towards the middle of the footprint: a pyramid, or a dome built from rings. Holes are ignored.
 * With a lantern, the roof stops where it has narrowed to the lantern's size and a small six-sided turret stands there.
 */
function radialRoof(outer: Xy[], shape: RoofShape, height: number | undefined, lantern?: number): Xyz[] {
  const box = longAxis(outer);
  const top = height ?? defaultHeight(shape, box.width);
  const center = middle(outer);
  const radius = outer.reduce((sum, point) => sum + Math.hypot(point[0] - center[0], point[1] - center[1]), 0) / outer.length;
  /** Share of the outline's size at which the roof stops: 0 is a point. */
  const cut = lantern ? Math.min(0.8, lantern / 2 / radius) : 0;
  const rings = shape === 'dome' ? DOME_RINGS : 1;
  const ring = (step: number): Xyz[] => {
    const angle = (step / rings) * Math.acos(cut);
    const scale = shape === 'dome' ? Math.cos(angle) : 1 - (step / rings) * (1 - cut);
    const z = shape === 'dome' ? Math.sin(angle) * top : (1 - scale) * top;
    return outer.map((point) => [center[0] + (point[0] - center[0]) * scale, center[1] + (point[1] - center[1]) * scale, z]);
  };
  const mesh = new Mesh();
  for (let step = 0; step < rings; step++) {
    const [lower, upper] = [ring(step), ring(step + 1)];
    lower.forEach((point, index) => {
      const next = (index + 1) % lower.length;
      mesh.add(point, lower[next]!, upper[next]!);
      mesh.add(point, upper[next]!, upper[index]!);
    });
  }
  if (cut > 0) {
    const foot = ring(rings)[0]![2];
    // A little wider than the opening and starting just below it, so no gap shows.
    const drum = circle(center, cut * radius * 1.1, LANTERN_SIDES);
    drum.forEach((point, index) => {
      const next = drum[(index + 1) % drum.length]!;
      mesh.wall(point, next, foot - 0.3, foot + LANTERN_DRUM_METERS, foot - 0.3, foot + LANTERN_DRUM_METERS);
      mesh.add([...point, foot + LANTERN_DRUM_METERS], [...next, foot + LANTERN_DRUM_METERS], [...center, foot + LANTERN_METERS]);
    });
  }
  return mesh.triangles;
}

const RIM_METERS = 1;
/** Deep enough for the skylights' slopes to catch the light: on an 11 m cell, a lower pyramid looks flat. */
const RIM_HEIGHT = 2.5;
const COFFER_METERS = 11;
const GRID_SHRINK_METERS = 0.25;
const GRID_SHRINK_STEPS = 20;
const CELL_SLACK_METERS = 1.2;
/** How high a skylight rises, as a share of the rim, so its tip stays below the rim. */
const COFFER_SHARE = 0.85;

const signedArea = (ring: Xy[]) =>
  ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]!;
    return sum + (point[0] * next[1] - next[0] * point[1]) / 2;
  }, 0);

/** The ring moved inwards by `distance`, corner by corner. Good for boxes and near-boxes, not for narrow or jagged outlines. */
function inset(ring: Xy[], distance: number): Xy[] {
  const turn = signedArea(ring) >= 0 ? 1 : -1;
  const inward = (a: Xy, b: Xy): Xy => {
    const size = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(-(b[1] - a[1]) / size) * turn, ((b[0] - a[0]) / size) * turn];
  };
  return ring.map((point, index) => {
    const before = inward(ring[(index + ring.length - 1) % ring.length]!, point);
    const after = inward(point, ring[(index + 1) % ring.length]!);
    const mitre = distance / Math.max(0.25, 1 + dot(before, after));
    return [point[0] + (before[0] + after[0]) * mitre, point[1] + (before[1] + after[1]) * mitre];
  });
}

function inside(point: Xy, ring: Xy[]): boolean {
  let within = false;
  for (let index = 0, last = ring.length - 1; index < ring.length; last = index++) {
    const [a, b] = [ring[index]!, ring[last]!];
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) within = !within;
  }
  return within;
}

/**
 * A rim along the outline and, inside it, a grid of low pyramids: the skylight
 * roof of the FAU building. It stands on the building's flat top.
 */
function cofferedRoof(outer: Xy[], spec: RoofSpec): Xyz[] {
  const rim = spec.height ?? RIM_HEIGHT;
  const hasRim = spec.rim !== false;
  const inner = hasRim ? inset(outer, RIM_METERS) : outer;
  const mesh = new Mesh();
  if (hasRim) {
    outer.forEach((point, index) => {
      const next = (index + 1) % outer.length;
      mesh.wall(point, outer[next]!, 0, rim, 0, rim);
      mesh.add([...point, rim], [...outer[next]!, rim], [...inner[next]!, rim]);
      mesh.add([...point, rim], [...inner[next]!, rim], [...inner[index]!, rim]);
    });
  }

  const along = spec.ridge !== undefined ? unit(spec.ridge) : longAxis(outer).axis;
  const across: Xy = [-along[1], along[0]];
  const [us, vs] = [inner.map((point) => dot(point, along)), inner.map((point) => dot(point, across))];
  const at = (u: number, v: number): Xy => [u * along[0] + v * across[0], u * along[1] + v * across[1]];
  // Mapped boxes are rarely square to the centimetre: pull the grid in until its own corners are inside the rim.
  // An outline that is not a box (stepped, L-shaped) never gets there, and keeps the full grid.
  const full = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)] as const;
  let [u0, u1, v0, v1] = full;
  // Corners are tested a centimetre in, so a grid lying exactly on the outline fits.
  const fits = () =>
    [[u0 + 0.01, v0 + 0.01], [u1 - 0.01, v0 + 0.01], [u1 - 0.01, v1 - 0.01], [u0 + 0.01, v1 - 0.01]].every(([u, v]) => inside(at(u!, v!), inner));
  for (let step = 0; step < GRID_SHRINK_STEPS && !fits(); step++) {
    [u0, u1, v0, v1] = [u0 + GRID_SHRINK_METERS, u1 - GRID_SHRINK_METERS, v0 + GRID_SHRINK_METERS, v1 - GRID_SHRINK_METERS];
  }
  if (!fits()) [u0, u1, v0, v1] = full;
  const [lengthU, lengthV] = [u1 - u0, v1 - v0];
  if (lengthU <= 0 || lengthV <= 0) return mesh.triangles;
  // Whole cells only, stretched a little so the grid fills the roof from rim to rim.
  const [countU, countV] = [lengthU, lengthV].map((length) => Math.max(1, Math.round(length / (spec.cell ?? COFFER_METERS)))) as [number, number];
  const [stepU, stepV] = [lengthU / countU, lengthV / countV];
  for (let column = 0; column < countU; column++) {
    for (let row = 0; row < countV; row++) {
      const [left, bottom] = [u0 + column * stepU, v0 + row * stepV];
      const tip = at(left + stepU / 2, bottom + stepV / 2);
      const corners = [at(left, bottom), at(left + stepU, bottom), at(left + stepU, bottom + stepV), at(left, bottom + stepV)];
      // Tested about a metre inside each corner, so a cell that touches a slightly skewed outline still counts.
      const slack = Math.min(0.3, CELL_SLACK_METERS / (Math.hypot(stepU, stepV) / 2));
      if (!corners.every((corner) => inside([corner[0] + (tip[0] - corner[0]) * slack, corner[1] + (tip[1] - corner[1]) * slack], inner))) continue;
      corners.forEach((corner, index) => mesh.add([...corner, 0], [...corners[(index + 1) % 4]!, 0], [...tip, rim * COFFER_SHARE]));
    }
  }
  return mesh.triangles;
}

/** Whether the roof stands on the building's flat top, instead of replacing the top of its walls. */
export const standsOnTop = (spec: RoofSpec) => spec.diameter !== undefined || spec.shape === 'coffered';

/** Roof height when none is given, from the width the roof spans. */
export function defaultHeight(shape: RoofShape, width: number): number {
  if (shape === 'dome') return width / 2;
  if (shape === 'sawtooth') return 2;
  if (shape === 'skillion') return Math.min(3, Math.max(1, width * 0.15));
  return Math.min(8, Math.max(1.5, width * (shape === 'pyramidal' ? 0.3 : 0.25)));
}

const dropClosing = (ring: Xy[]) => {
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first && last && ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
};

/**
 * The triangles of a roof standing on a footprint, as x (east), y (north),
 * z (above the eave) triples in metres. `rings` are the footprint's outline
 * and holes, in metres.
 */
export function buildRoof(rings: Xy[][], spec: RoofSpec): number[] {
  const open = rings.map(dropClosing).filter((ring) => ring.length >= 3);
  if (open.length === 0) return [];
  if (spec.shape === 'coffered') return cofferedRoof(open[0]!, spec).flat();
  const triangles = spec.shape === 'pyramidal' || spec.shape === 'dome'
    ? radialRoof(
        spec.diameter ? circle(middle(open[0]!), spec.diameter / 2) : open[0]!,
        spec.shape,
        spec.height ?? (spec.diameter ? defaultHeight(spec.shape, spec.diameter) : undefined),
        spec.lantern,
      )
    : profileRoof(open, spec.shape, spec.height, spec);
  return triangles.flat();
}

/** Highest point of a roof built by `buildRoof`. */
export const roofTop = (triangles: number[]) => triangles.reduce((top, value, index) => (index % 3 === 2 ? Math.max(top, value) : top), 0);
