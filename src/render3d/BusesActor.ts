import * as THREE from 'three';
import { BUS_3D_MIN_ZOOM } from '../config';
import { busTracker, MAX_BUSES } from '../features/transit/busTracker';
import { createBusGeometry } from './busGeometry';
import type { FrameContext, SceneActor } from './CampusScene';

/** Every live bus as one instanced mesh: one draw call however many buses there are. */
export class BusesActor implements SceneActor {
  readonly object: THREE.InstancedMesh;
  private readonly placement = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor() {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.object = new THREE.InstancedMesh(createBusGeometry(), material, MAX_BUSES);
    this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // MapLibre's projection matrix is not a camera Three.js can cull against.
    this.object.frustumCulled = false;
    this.object.count = 0;
  }

  update({ now, zoom, toLocal }: FrameContext): boolean {
    const poses = zoom >= BUS_3D_MIN_ZOOM ? busTracker.poses(now) : [];
    // Real size up close; a little larger further out so buses stay easy to spot.
    const scale = Math.max(1, Math.min(2.6, 2 ** ((18 - zoom) * 0.6)));

    poses.forEach((pose, index) => {
      const [east, north] = toLocal(pose.position[0], pose.position[1]);
      this.placement.position.set(east, 0, north);
      this.placement.rotation.set(0, pose.heading, 0);
      this.placement.scale.setScalar(scale);
      this.placement.updateMatrix();
      this.object.setMatrixAt(index, this.placement.matrix);
      this.object.setColorAt(index, this.color.set(pose.color));
    });

    this.object.count = poses.length;
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) this.object.instanceColor.needsUpdate = true;
    return poses.length > 0;
  }

  dispose() {
    this.object.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
    this.object.dispose();
  }
}
