/**
 * Entry of the lazy 3D chunk: everything that imports Three.js lives behind
 * this module, which is only loaded with `import()` once the map is ready and
 * only when lite mode is off.
 */
import { CAMPUS_CENTER } from '../config';
import { decodeTrees, type TreesFile } from '../domain/trees';
import { dataUrl } from '../map/staticData';
import { BusesActor } from './BusesActor';
import { CampusScene, type SceneActor } from './CampusScene';
import { TreesActor } from './TreesActor';

export { SCENE_LAYER_ID } from './CampusScene';

/** Trees are decoration: if the file cannot be loaded the scene simply has none. */
async function loadTrees(): Promise<SceneActor[]> {
  try {
    const response = await fetch(dataUrl('trees.json'));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return [new TreesActor(decodeTrees((await response.json()) as TreesFile))];
  } catch (error) {
    console.warn('Trees unavailable', error);
    return [];
  }
}

export async function createCampusScene(): Promise<CampusScene> {
  return new CampusScene([CAMPUS_CENTER.longitude, CAMPUS_CENTER.latitude], [...(await loadTrees()), new BusesActor()]);
}
