import * as THREE from 'three';
import { ACCESS_COLORS, decodeAccess } from '../domain/access';
import { ROOF_UNIT_METERS, type RoofEntry } from '../domain/roofs';
import { SELECTED_COLOR, UNKNOWN_ACCESS_COLOR } from '../features/buildings/colors';
import { useAppStore } from '../state/store';
import type { FrameContext, SceneActor } from './CampusScene';

/** Which colours the roofs show: their own, or the accessibility view's, with the selected building highlighted. */
type Look = { accessMode: boolean; selectedId: string | undefined };

/**
 * The shaped roofs of landmark buildings, and monuments, merged into one mesh. Their walls are
 * the building layer's extrusions, which stop at the eave while this layer is on.
 */
export class RoofsActor implements SceneActor {
  readonly object: THREE.Mesh;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly colors: THREE.BufferAttribute;
  /** The roof left out of the last placement: `undefined` before the first one, '' for none. */
  private placedWithout: string | undefined;
  private look: Look | undefined;

  constructor(private readonly roofs: RoofEntry[]) {
    const vertices = roofs.reduce((sum, roof) => sum + roof.p.length / 3, 0);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    this.colors = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
    this.geometry.setAttribute('color', this.colors);
    // Roof triangles are not wound consistently, so both sides are drawn.
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    this.object = new THREE.Mesh(this.geometry, material);
    // MapLibre's projection matrix is not a camera Three.js can cull against.
    this.object.frustumCulled = false;
  }

  /** Writes the vertices. The roof of `hiddenId` is folded into one point, so it draws nothing. */
  private place(toLocal: FrameContext['toLocal'], hiddenId: string) {
    const position = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    let vertex = 0;
    for (const roof of this.roofs) {
      const [east, north] = toLocal(roof.at[0], roof.at[1]);
      if (roof.id === hiddenId) {
        for (let index = 0; index < roof.p.length; index += 3) position.setXYZ(vertex++, east, roof.base, north);
        continue;
      }
      for (let index = 0; index < roof.p.length; index += 3) {
        // The file is east, north, up; the scene is x east, y up, z north.
        position.setXYZ(
          vertex++,
          east + roof.p[index]! * ROOF_UNIT_METERS,
          roof.base + roof.p[index + 2]! * ROOF_UNIT_METERS,
          north + roof.p[index + 1]! * ROOF_UNIT_METERS,
        );
      }
    }
    position.needsUpdate = true;
    this.placedWithout = hiddenId;
  }

  private paint(look: Look) {
    const color = new THREE.Color();
    let vertex = 0;
    for (const roof of this.roofs) {
      if (roof.id === look.selectedId) color.set(SELECTED_COLOR);
      else if (!look.accessMode) color.set(roof.c);
      else color.set(roof.acc === 'u' ? UNKNOWN_ACCESS_COLOR : ACCESS_COLORS[decodeAccess(roof.acc)]);
      for (let index = 0; index < roof.p.length; index += 3) this.colors.setXYZ(vertex++, color.r, color.g, color.b);
    }
    this.colors.needsUpdate = true;
    this.look = look;
  }

  update({ toLocal }: FrameContext): boolean {
    const { accessMode, selection, indoor } = useAppStore.getState();
    // A building showing its floor plan has no block, so no roof either.
    const hiddenId = indoor?.buildingId ?? '';
    if (this.placedWithout !== hiddenId) this.place(toLocal, hiddenId);
    // A roof belongs to a building and a monument to a POI.
    const selectedId = selection?.kind === 'building' || selection?.kind === 'poi' ? selection.id : undefined;
    if (this.look?.accessMode !== accessMode || this.look.selectedId !== selectedId) this.paint({ accessMode, selectedId });
    return false;
  }

  dispose() {
    this.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
  }
}
