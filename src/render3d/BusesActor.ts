import * as THREE from 'three';
import { BUS_3D_MIN_ZOOM } from '../config';
import { busTracker, MAX_BUSES } from '../features/transit/busTracker';
import { createBusGeometry } from './busGeometry';
import type { FrameContext, SceneActor } from './CampusScene';

/** Every live bus as two instanced meshes: two draw calls however many buses there are. */
export class BusesActor implements SceneActor {
  readonly object = new THREE.Group();
  /** The hull, tinted per bus with its line colour. */
  private readonly paint: THREE.InstancedMesh;
  /** Glass, lights and wheels, which keep their own colours. */
  private readonly details: THREE.InstancedMesh;
  private readonly placement = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor() {
    const geometry = createBusGeometry();
    this.paint = new THREE.InstancedMesh(geometry.paint, new THREE.MeshLambertMaterial(), MAX_BUSES);
    this.details = new THREE.InstancedMesh(
      geometry.details,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      MAX_BUSES,
    );
    this.paint.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Both meshes are placed identically, so they share one matrix buffer.
    this.details.instanceMatrix = this.paint.instanceMatrix;
    for (const mesh of [this.paint, this.details]) {
      // MapLibre's projection matrix is not a camera Three.js can cull against.
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.object.add(mesh);
    }
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
      this.paint.setMatrixAt(index, this.placement.matrix);
      this.paint.setColorAt(index, this.color.set(pose.color));
    });

    this.paint.count = poses.length;
    this.details.count = poses.length;
    this.paint.instanceMatrix.needsUpdate = true;
    if (this.paint.instanceColor) this.paint.instanceColor.needsUpdate = true;
    return poses.length > 0;
  }

  dispose() {
    for (const mesh of [this.paint, this.details]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}
