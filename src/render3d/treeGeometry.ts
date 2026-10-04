import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function tinted(geometry: THREE.BufferGeometry, [r, g, b]: [number, number, number]): THREE.BufferGeometry {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = plain.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) colors.set([r, g, b], index * 3);
  plain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return plain;
}

/**
 * A low-poly tree one unit tall with its base at y = 0: trunk and crown in a
 * single geometry, so the whole campus is one instanced draw call. Each
 * instance scales it to its height and width and tints it slightly.
 */
export function createTreeGeometry(): THREE.BufferGeometry {
  const trunk = tinted(new THREE.CylinderGeometry(0.035, 0.055, 0.45, 5, 1, true).translate(0, 0.225, 0), [0.3, 0.2, 0.13]);
  const crown = tinted(new THREE.IcosahedronGeometry(0.34, 0).scale(1, 1.1, 1).translate(0, 0.66, 0), [0.24, 0.47, 0.2]);
  const merged = mergeGeometries([trunk, crown]);
  trunk.dispose();
  crown.dispose();
  merged.computeVertexNormals();
  return merged;
}
