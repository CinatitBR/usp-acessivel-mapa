import { loadBuildings, loadInstitutes, loadPois, loadStops } from '../../map/staticData';
import { buildDocs, createSearch, type SearchFn } from './engine';

let engine: Promise<SearchFn> | undefined;

/**
 * Builds the offline index on first use. This module (and MiniSearch with it)
 * is loaded with a dynamic import when the search box is first focused.
 */
export function loadSearch(): Promise<SearchFn> {
  engine ??= Promise.all([loadBuildings(), loadPois(), loadInstitutes(), loadStops()])
    .then(([buildings, pois, institutes, stops]) => createSearch(buildDocs({ buildings, pois, institutes, stops })));
  engine.catch(() => {
    engine = undefined;
  });
  return engine;
}
