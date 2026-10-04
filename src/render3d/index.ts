/**
 * Entry of the lazy 3D chunk: everything that imports Three.js lives behind
 * this module, which is only loaded with `import()` once the map is ready and
 * only when lite mode is off.
 */
import { CAMPUS_CENTER } from '../config';
import type { RoofsFile } from '../domain/roofs';
import { decodeTrees, type TreesFile } from '../domain/trees';
import { dataUrl } from '../map/staticData';
import { BusesActor } from './BusesActor';
import { CampusScene, type SceneActor } from './CampusScene';
import { RoofsActor } from './RoofsActor';
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

/** Roofs are decoration too: without the file the buildings keep their flat tops. */
async function loadRoofs(): Promise<SceneActor[]> {
  try {
    const response = await fetch(dataUrl('roofs.json'));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { roofs } = (await response.json()) as RoofsFile;
    return roofs.length > 0 ? [new RoofsActor(roofs)] : [];
  } catch (error) {
    console.warn('Roofs unavailable', error);
    return [];
  }
}

/** `hasRoofs` tells the building layer whether to stop its walls at the eaves. */
export async function createCampusScene(): Promise<{ layer: CampusScene; hasRoofs: boolean }> {
  const [trees, roofs] = await Promise.all([loadTrees(), loadRoofs()]);
  const layer = new CampusScene([CAMPUS_CENTER.longitude, CAMPUS_CENTER.latitude], [...trees, ...roofs, new BusesActor()]);
  return { layer, hasRoofs: roofs.length > 0 };
}
