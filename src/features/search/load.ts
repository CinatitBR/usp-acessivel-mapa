import { loadBuildings, loadInstitutes, loadPois } from '../../map/staticData';
import { buildDocs, createSearch, type SearchFn } from './engine';

let engine: Promise<SearchFn> | undefined;

/**
 * Builds the offline index on first use. This module (and MiniSearch with it)
 * is loaded with a dynamic import when the search box is first focused.
 */
export function loadSearch(): Promise<SearchFn> {
  engine ??= Promise.all([loadBuildings(), loadPois(), loadInstitutes()])
    .then(([buildings, pois, institutes]) => createSearch(buildDocs({ buildings, pois, institutes })));
  engine.catch(() => {
    engine = undefined;
  });
  return engine;
}
