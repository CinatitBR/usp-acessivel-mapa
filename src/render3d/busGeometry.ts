import * as THREE from 'three';

/** A city bus in metres. The front faces +z (north at heading 0); the wheels rest on y = 0. */
const LENGTH = 12;
const WIDTH = 2.55;
const FLOOR = 0.35;
const ROOF = 3;
/** The windscreen leans back from this height up to the roof edge. */
const BEND = 1.25;
const RAKE = 0.4;

const HALF_W = WIDTH / 2;
const FRONT_Z = LENGTH / 2;
const REAR_Z = -LENGTH / 2;
const WHEEL_RADIUS = 0.5;
const WHEEL_FRONT_Z = 3.5;
const WHEEL_REAR_Z = -3;
/** How far each layer of flat detail floats off the hull, so it does not z-fight. */
const PROUD = 0.012;

const GLASS = '#4A3F52';
const GLASS_LIGHT = '#5E5266';
const TRIM = '#3A3F42';
const SLAT = '#8A9094';
const ORANGE = '#F08030';
const RED = '#8E2A35';
const ARCH = '#8E3A2A';
const WHITE = '#E6E8EA';
const PLATE = '#9AA0A6';
const TYRE = '#2A2A2A';
const HUB = '#B8BCC0';

type Point = [x: number, y: number, z: number];
type Point2 = [number, number];

/** Collects flat-shaded convex polygons into one geometry. */
class Builder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private readonly color = new THREE.Color();

  /** `out` is the rough outward direction; the winding is flipped to match it. */
  poly(points: Point[], out: Point, color?: string) {
    const [a, b, c] = points.map((point) => new THREE.Vector3(...point));
    if (!a || !b || !c) return;
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    let ordered = points;
    if (normal.dot(new THREE.Vector3(...out)) < 0) {
      ordered = [...points].reverse();
      normal.negate();
    }
    const base = this.positions.length / 3;
    if (color) this.color.set(color);
    for (const point of ordered) {
      this.positions.push(...point);
      this.normals.push(normal.x, normal.y, normal.z);
      if (color) this.colors.push(this.color.r, this.color.g, this.color.b);
    }
    for (let index = 1; index < ordered.length - 1; index += 1) this.indices.push(base, base + index, base + index + 1);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    if (this.colors.length > 0) geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

/** Z of the front face at a given height: vertical below the bend, raked above it. */
function frontZ(y: number): number {
  return y <= BEND ? FRONT_Z : FRONT_Z - ((y - BEND) / (ROOF - BEND)) * RAKE;
}

function rect(x0: number, x1: number, y0: number, y1: number): Point2[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

function ring(radius: number, sides: number): Point2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

/** Flat shapes drawn just off one face of the hull. Side shapes are given as [z, y], the others as [x, y]. */
function decals(builder: Builder) {
  return {
    side(side: 1 | -1, shape: Point2[], color: string, layer = 1) {
      builder.poly(shape.map(([z, y]) => [side * (HALF_W + PROUD * layer), y, z]), [side, 0, 0], color);
    },
    front(shape: Point2[], color: string, layer = 1) {
      builder.poly(shape.map(([x, y]) => [x, y, frontZ(y) + PROUD * layer]), [0, 0, 1], color);
    },
    rear(shape: Point2[], color: string, layer = 1) {
      builder.poly(shape.map(([x, y]) => [x, y, REAR_Z - PROUD * layer]), [0, 0, -1], color);
    },
  };
}

/** A tyre lying across the bus, with a hub cap on the given side. */
function wheel(builder: Builder, x: number, z: number, width: number, hubSide: 1 | -1 | 0) {
  const rim = ring(WHEEL_RADIUS, 10);
  const at = (across: number, [y, along]: Point2): Point => [across, WHEEL_RADIUS + y, z + along];
  const x0 = x - width / 2;
  const x1 = x + width / 2;
  rim.forEach((from, index) => {
    const to = rim[(index + 1) % rim.length] ?? from;
    builder.poly([at(x0, from), at(x1, from), at(x1, to), at(x0, to)], [0, from[0] + to[0], from[1] + to[1]], TYRE);
  });
  builder.poly(rim.map((point) => at(x0, point)), [-1, 0, 0], TYRE);
  builder.poly(rim.map((point) => at(x1, point)), [1, 0, 0], TYRE);
  if (hubSide !== 0) {
    const face = x + hubSide * (width / 2 + 0.01);
    builder.poly(ring(0.28, 8).map((point) => at(face, point)), [hubSide, 0, 0], HUB);
  }
}

/** The painted hull: a five-sided profile extruded across the width. Takes the line colour. */
function createPaint(): THREE.BufferGeometry {
  const builder = new Builder();
  const roofFrontZ = FRONT_Z - RAKE;
  const profile: Point2[] = [[REAR_Z, FLOOR], [FRONT_Z, FLOOR], [FRONT_Z, BEND], [roofFrontZ, ROOF], [REAR_Z, ROOF]];
  for (const side of [1, -1]) builder.poly(profile.map(([z, y]) => [side * HALF_W, y, z]), [side, 0, 0]);

  const span = (z0: number, y0: number, z1: number, y1: number, out: Point) =>
    builder.poly([[-HALF_W, y0, z0], [HALF_W, y0, z0], [HALF_W, y1, z1], [-HALF_W, y1, z1]], out);
  span(REAR_Z, ROOF, roofFrontZ, ROOF, [0, 1, 0]);
  span(REAR_Z, FLOOR, FRONT_Z, FLOOR, [0, -1, 0]);
  span(REAR_Z, FLOOR, REAR_Z, ROOF, [0, 0, -1]);
  span(FRONT_Z, FLOOR, FRONT_Z, BEND, [0, 0, 1]);
  span(FRONT_Z, BEND, roofFrontZ, ROOF, [0, 0, 1]);
  return builder.build();
}

/** Everything that keeps its own colour whatever the line: glass, lights, wheels. */
function createDetails(): THREE.BufferGeometry {
  const builder = new Builder();
  const { side, front, rear } = decals(builder);

  // Windows: a tall pane with a thin transom above it, in evenly spaced bays.
  const bays = (which: 1 | -1, z0: number, z1: number, count: number) => {
    const gap = 0.08;
    const width = (z1 - z0 - gap * (count - 1)) / count;
    for (let index = 0; index < count; index += 1) {
      const start = z0 + index * (width + gap);
      side(which, rect(start, start + width, 1.5, 2.5), GLASS);
      side(which, rect(start, start + width, 2.58, 2.82), GLASS);
    }
  };
  bays(-1, -5.7, 5.45, 7);
  // The door is on +x: the bus's right, the kerb side.
  bays(1, -5.7, 0.45, 5);
  bays(1, 2.05, 5.45, 3);
  for (const start of [0.62, 1.28]) {
    side(1, rect(start, start + 0.6, 0.85, 1.4), GLASS);
    side(1, rect(start, start + 0.6, 1.5, 2.82), GLASS);
  }

  for (const which of [1, -1] as const) {
    for (const z of [WHEEL_FRONT_Z, WHEEL_REAR_Z]) {
      const radius = 0.66;
      const arc = Array.from({ length: 9 }, (_, index): Point2 => {
        const angle = (index / 8) * Math.PI;
        return [z + Math.cos(angle) * radius, WHEEL_RADIUS + Math.sin(angle) * radius];
      });
      side(which, [[z + radius, FLOOR], ...arc, [z - radius, FLOOR]], ARCH);
    }
    side(which, rect(5.7, 5.85, 0.95, 1.1), ORANGE);
    side(which, rect(-5.9, -5.75, 1.15, 1.3), ORANGE);
    side(which, rect(-5.9, -5.75, 2.78, 2.93), ORANGE);

    // Tyres sit 5 cm proud of the hull; the rear axle has twin tyres.
    const outer = which * (HALF_W + 0.05);
    wheel(builder, outer - which * 0.15, WHEEL_FRONT_Z, 0.3, which);
    wheel(builder, outer - which * 0.14, WHEEL_REAR_Z, 0.28, which);
    wheel(builder, outer - which * 0.48, WHEEL_REAR_Z, 0.28, 0);
  }

  // Front: windscreen with a centre post and wipers, destination box, headlights.
  front(rect(-1.13, 1.13, 1.38, 2.68), GLASS);
  front(rect(-0.035, 0.035, 1.38, 2.68), GLASS_LIGHT, 2);
  front(rect(-0.4, 0.4, 2.74, 2.94), TRIM);
  for (const x of [-0.98, 0.12]) front([[x, 1.44], [x + 0.7, 1.6], [x + 0.7, 1.64], [x, 1.48]], TRIM, 2);
  for (const s of [1, -1]) {
    front(rect(s * 0.93, s * 1.09, 2.76, 2.92), ORANGE);
    front(rect(s * 0.74, s * 0.9, 0.84, 1.1), WHITE);
    front(rect(s * 0.94, s * 1.1, 0.84, 1.1), WHITE);
    front(rect(s * 0.76, s * 1.08, 1.15, 1.19), ORANGE);
  }

  // Rear: louvred window, lights, engine hatch outline, licence plate.
  rear(rect(-1, 1, 1.95, 2.75), TRIM);
  for (const y of [2, 2.19, 2.38, 2.57]) rear(rect(-0.94, 0.94, y, y + 0.15), SLAT, 2);
  for (const x of [-0.13, 0.13]) rear(ring(0.1, 8).map(([dx, dy]): Point2 => [x + dx, 1.55 + dy]), RED);
  for (const s of [1, -1]) {
    rear(rect(s * 0.95, s * 1.15, 1.3, 1.5), ORANGE);
    rear(rect(s * 0.95, s * 1.15, 1.04, 1.24), RED);
    rear(rect(s * 0.95, s * 1.15, 0.9, 0.99), RED);
    rear(rect(s * 0.95, s * 1.15, 0.74, 0.85), WHITE);
    rear(rect(s * 0.775, s * 0.8, 0.72, 1.3), TRIM);
  }
  rear(rect(-0.8, 0.8, 1.3, 1.325), TRIM);
  rear(rect(0.25, 0.7, 0.84, 1.08), PLATE);

  return builder.build();
}

/**
 * Low-poly bus as two geometries that share every instance's placement, so
 * all the buses on the map are two instanced calls: `paint` is the hull and
 * takes the line colour, `details` carries its own vertex colours.
 */
export function createBusGeometry(): { paint: THREE.BufferGeometry; details: THREE.BufferGeometry } {
  return { paint: createPaint(), details: createDetails() };
}
