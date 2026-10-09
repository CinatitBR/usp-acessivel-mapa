import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Rgb = [number, number, number];

const mix = (from: Rgb, to: Rgb, t: number): Rgb => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

/**
 * Colours every face with one flat colour: a gradient from `low` at the
 * bottom of the part to `high` at its top, lifted a little on faces that look
 * up at the sky.
 */
function shaded(geometry: THREE.BufferGeometry, low: Rgb, high: Rgb, skyLift = 0): THREE.BufferGeometry {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  plain.computeVertexNormals();
  const box = new THREE.Box3().setFromBufferAttribute(plain.getAttribute('position') as THREE.BufferAttribute);
  const position = plain.getAttribute('position');
  const normal = plain.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  for (let face = 0; face < position.count; face += 3) {
    const y = (position.getY(face) + position.getY(face + 1) + position.getY(face + 2)) / 3;
    const height = (y - box.min.y) / (box.max.y - box.min.y);
    const up = Math.max(0, normal.getY(face));
    const color = mix(low, high, Math.min(1, height * (1 - skyLift) + up * skyLift));
    for (let corner = 0; corner < 3; corner += 1) colors.set(color, (face + corner) * 3);
  }
  plain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  plain.deleteAttribute('uv');
  return plain;
}

/** One faceted lump of foliage. */
function lump(radius: number, scale: Rgb, center: Rgb, turn: number, shade: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(radius, 0)
    .rotateY(turn)
    .rotateX(turn * 0.6)
    .scale(...scale)
    .translate(...center);
  return shaded(geometry, [0.12 * shade, 0.31 * shade, 0.13 * shade], [0.4 * shade, 0.62 * shade, 0.2 * shade], 0.45);
}

/**
 * A low-poly tree one unit tall with its base at y = 0: a flared trunk under a
 * crown of three overlapping lumps, in a single geometry, so the whole campus
 * is one instanced draw call. Each instance scales it to its height and width
 * and tints it slightly.
 */
export function createTreeGeometry(): THREE.BufferGeometry {
  const profile = [new THREE.Vector2(0.075, 0), new THREE.Vector2(0.042, 0.09), new THREE.Vector2(0.03, 0.5)];
  const parts = [
    shaded(new THREE.LatheGeometry(profile, 5), [0.2, 0.13, 0.09], [0.36, 0.25, 0.16]),
    lump(0.3, [1.08, 0.86, 1.08], [0, 0.6, 0], 0.4, 1),
    lump(0.21, [1.1, 0.9, 1], [0.2, 0.5, 0.1], 1.9, 0.9),
    lump(0.2, [1, 0.95, 1.05], [-0.08, 0.81, -0.07], 3.1, 1.08),
  ];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}
