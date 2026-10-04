import * as THREE from 'three';
import { TREE_MIN_ZOOM } from '../config';
import type { Tree } from '../domain/trees';
import type { FrameContext, SceneActor } from './CampusScene';
import { createTreeGeometry } from './treeGeometry';

/** Hard cap on instances, whatever the data file contains. */
const MAX_TREES = 4000;

/** Three independent pseudo-random values in [0, 1) from a tree's 0–255 seed. */
const spread = (seed: number, salt: number) => ((seed * 97 + salt * 57) % 256) / 256;

/**
 * Every campus tree as one instanced mesh. Trees never move, so their matrices
 * are written once, on the first frame, and the actor never asks to animate.
 */
export class TreesActor implements SceneActor {
  readonly object: THREE.InstancedMesh;
  private readonly trees: Tree[];
  private placed = false;

  constructor(trees: Tree[]) {
    this.trees = trees.slice(0, MAX_TREES);
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.object = new THREE.InstancedMesh(createTreeGeometry(), material, Math.max(1, this.trees.length));
    this.object.count = this.trees.length;
    // MapLibre's projection matrix is not a camera Three.js can cull against.
    this.object.frustumCulled = false;
  }

  private place(toLocal: FrameContext['toLocal']) {
    const placement = new THREE.Object3D();
    const tint = new THREE.Color();
    this.trees.forEach((tree, index) => {
      const [east, north] = toLocal(tree.position[0], tree.position[1]);
      const width = tree.height * (0.8 + spread(tree.seed, 1) * 0.5);
      placement.position.set(east, 0, north);
      placement.rotation.set(0, spread(tree.seed, 2) * Math.PI * 2, 0);
      placement.scale.set(width, tree.height, width);
      placement.updateMatrix();
      this.object.setMatrixAt(index, placement.matrix);
      // Slightly different greens, so a wood does not look stamped.
      this.object.setColorAt(index, tint.setRGB(0.8 + spread(tree.seed, 3) * 0.35, 0.85 + spread(tree.seed, 4) * 0.25, 0.75 + spread(tree.seed, 5) * 0.3));
    });
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) this.object.instanceColor.needsUpdate = true;
    this.placed = true;
  }

  update({ zoom, toLocal }: FrameContext): boolean {
    if (!this.placed) this.place(toLocal);
    this.object.visible = zoom >= TREE_MIN_ZOOM;
    return false;
  }

  dispose() {
    this.object.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
    this.object.dispose();
  }
}
