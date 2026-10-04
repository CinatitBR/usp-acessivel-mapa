import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A city bus in metres. The front faces +z (north at heading 0); the wheels rest on y = 0. */
const LENGTH = 12;
const WIDTH = 2.55;
const FLOOR = 0.35;
const BODY_HEIGHT = 2.75;

/** A box whose every vertex carries one grey level; the instance colour multiplies it. */
function box(size: [number, number, number], center: [number, number, number], shade: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...size).translate(...center);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3).fill(shade);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Low-poly bus as a single geometry, so every bus on the map is drawn in one
 * instanced call. Shades: 1 = body (takes the line colour), dark = glass and
 * tyres.
 */
export function createBusGeometry(): THREE.BufferGeometry {
  const glass = 0.16;
  const parts = [
    box([WIDTH, BODY_HEIGHT, LENGTH], [0, FLOOR + BODY_HEIGHT / 2, 0], 1),
    // Window band, slightly proud of the body so it does not z-fight.
    box([WIDTH + 0.06, 0.95, LENGTH * 0.86], [0, FLOOR + BODY_HEIGHT * 0.66, -0.2], glass),
    // Windscreen: only at the front, which shows the direction of travel.
    box([WIDTH * 0.86, 1.25, 0.08], [0, FLOOR + BODY_HEIGHT * 0.6, LENGTH / 2 + 0.02], glass),
    // Roof unit.
    box([WIDTH * 0.6, 0.22, LENGTH * 0.3], [0, FLOOR + BODY_HEIGHT + 0.11, -LENGTH * 0.15], 0.7),
  ];
  for (const x of [-WIDTH / 2, WIDTH / 2]) {
    for (const z of [-LENGTH * 0.3, LENGTH * 0.3]) parts.push(box([0.3, 0.9, 1], [x, 0.45, z], 0.08));
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}
