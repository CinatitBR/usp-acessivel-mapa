import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type LngLatLike,
  type Map as MaplibreMap,
  MercatorCoordinate,
} from 'maplibre-gl';
import * as THREE from 'three';
import { lightFromStyle } from './lighting';

export const SCENE_LAYER_ID = 'campus-3d';

/** What an actor needs each frame. */
export type FrameContext = {
  /** `performance.now()`-independent wall clock, in milliseconds. */
  now: number;
  zoom: number;
  /** Converts a geographic position to scene metres: [east, north] from the scene origin. */
  toLocal(lng: number, lat: number): [east: number, north: number];
};

/** One kind of 3D object (buses, trees). Each should cost about one draw call. */
export interface SceneActor {
  readonly object: THREE.Object3D;
  /** Updates the object for this frame. Returns true while it needs to keep animating. */
  update(context: FrameContext): boolean;
  dispose(): void;
}

/**
 * The app's only MapLibre custom layer: one Three.js renderer, scene and
 * camera shared by every actor. Scene units are metres from a fixed origin
 * (x east, y up, z north); the campus is small and flat, so the origin never
 * moves and there is no terrain.
 */
export class CampusScene implements CustomLayerInterface {
  readonly id = SCENE_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map?: MaplibreMap;
  private renderer?: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly sun = new THREE.DirectionalLight();
  private readonly sky = new THREE.HemisphereLight(0xffffff, 0xb9b3a8);
  private readonly origin: MercatorCoordinate;
  private readonly metre: number;
  private readonly originTransform: THREE.Matrix4;
  private readonly projection = new THREE.Matrix4();

  constructor(
    origin: LngLatLike,
    private readonly actors: SceneActor[],
  ) {
    this.origin = MercatorCoordinate.fromLngLat(origin, 0);
    this.metre = this.origin.meterInMercatorCoordinateUnits();
    // Scene metres to Mercator units: Mercator y grows southwards, hence the flip.
    this.originTransform = new THREE.Matrix4()
      .makeTranslation(this.origin.x, this.origin.y, this.origin.z)
      .scale(new THREE.Vector3(this.metre, -this.metre, this.metre));

    // Rotate "y up, z north" into MapLibre's "z up" once, so actors can think in plain metres.
    this.scene.rotateX(Math.PI / 2);
    this.scene.scale.multiply(new THREE.Vector3(1, 1, -1));
    this.scene.add(this.sun, this.sky);
    for (const actor of actors) this.scene.add(actor.object);
  }

  private readonly toLocal = (lng: number, lat: number): [number, number] => {
    const point = MercatorCoordinate.fromLngLat([lng, lat]);
    return [(point.x - this.origin.x) / this.metre, (this.origin.y - point.y) / this.metre];
  };

  /** Reads the sun from the style, so models and building extrusions share one light. */
  private readonly syncLight = () => {
    const light = lightFromStyle(this.map?.getStyle().light);
    this.sun.position.set(...light.direction);
    this.sun.color.set(light.color);
    this.sun.intensity = light.directional;
    this.sky.intensity = light.ambient;
    this.map?.triggerRepaint();
  };

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl as WebGL2RenderingContext });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.syncLight();
    map.on('styledata', this.syncLight);
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
    const { map, renderer } = this;
    if (!map || !renderer) return;

    const context: FrameContext = { now: Date.now(), zoom: map.getZoom(), toLocal: this.toLocal };
    let animating = false;
    for (const actor of this.actors) animating = actor.update(context) || animating;

    this.projection.fromArray(options.defaultProjectionData.mainMatrix).multiply(this.originTransform);
    this.camera.projectionMatrix.copy(this.projection);
    this.camera.projectionMatrixInverse.copy(this.projection).invert();

    // MapLibre and Three.js share one GL context; Three must not assume the state it left behind.
    renderer.resetState();
    renderer.render(this.scene, this.camera);
    if (animating) map.triggerRepaint();
  }

  onRemove(map: MaplibreMap) {
    map.off('styledata', this.syncLight);
    for (const actor of this.actors) actor.dispose();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = undefined;
    this.map = undefined;
  }
}
