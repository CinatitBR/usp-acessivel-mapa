/**
 * Entry of the lazy 3D chunk: everything that imports Three.js lives behind
 * this module, which is only loaded with `import()` once the map is ready and
 * only when lite mode is off.
 */
import { CAMPUS_CENTER } from '../config';
import { BusesActor } from './BusesActor';
import { CampusScene } from './CampusScene';

export { SCENE_LAYER_ID } from './CampusScene';

export function createCampusScene(): CampusScene {
  return new CampusScene([CAMPUS_CENTER.longitude, CAMPUS_CENTER.latitude], [new BusesActor()]);
}
