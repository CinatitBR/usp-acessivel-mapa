/** The part of a MapLibre style's `light` this app uses (plain values only, no expressions). */
type StyleLight = { position?: unknown; color?: unknown; intensity?: unknown };

export type SceneLight = {
  /** Unit vector pointing towards the light, in scene axes: x east, y up, z north. */
  direction: [east: number, up: number, north: number];
  color: string;
  /** Intensities for a Three.js DirectionalLight and HemisphereLight. */
  directional: number;
  ambient: number;
};

// MapLibre's defaults for a style without a `light` block.
const DEFAULT_POSITION = [1.15, 210, 30];
const DEFAULT_INTENSITY = 0.5;
const RADIANS = Math.PI / 180;

/**
 * Converts the style's light into Three.js terms, so 3D models are lit from
 * the same side as the building extrusions. The style stays the single source
 * of truth: change `light` in campus.json and both follow.
 *
 * MapLibre gives the position as [radial, azimuth, polar]: azimuth in degrees
 * clockwise from north (with `anchor: "map"`), polar 0° straight above.
 */
export function lightFromStyle(light: StyleLight | null | undefined): SceneLight {
  const position = Array.isArray(light?.position) && light.position.every((value) => typeof value === 'number')
    ? (light.position as number[])
    : DEFAULT_POSITION;
  const azimuth = (position[1] ?? DEFAULT_POSITION[1]!) * RADIANS;
  const polar = (position[2] ?? DEFAULT_POSITION[2]!) * RADIANS;
  const intensity = typeof light?.intensity === 'number' ? Math.max(0, Math.min(1, light.intensity)) : DEFAULT_INTENSITY;

  return {
    direction: [Math.sin(azimuth) * Math.sin(polar), Math.cos(polar), Math.cos(azimuth) * Math.sin(polar)],
    color: typeof light?.color === 'string' ? light.color : '#ffffff',
    // Extrusions are mostly ambient-lit with a directional accent; these factors give models a similar balance.
    directional: 3 * intensity,
    ambient: 2.4 * (1 - intensity) + 0.6,
  };
}
