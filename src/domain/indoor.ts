import type { LngLat } from './types';
import type { Feature, FeatureCollection, MultiLineString, Polygon } from 'geojson';

/** One floor of a building's indoor map. */
export type IndoorLevel = {
  /** What the level switcher shows: -1, 0, 1… */
  id: number;
  name: string;
  /** Heights of the floor above the ground, as written on the plan. */
  elevations: string;
};

export type IndoorLevelProperties = { level: number };

/**
 * A file of public/data/indoor/, written by scripts/build-campus.ts: the floor
 * plans of one building. Fetched when its indoor map is opened.
 */
export type IndoorPlan = {
  /** Id of the building. */
  building: string;
  /** Who drew the plan. */
  credit: string;
  defaultLevel: number;
  /** Compass bearing that puts the plan upright, as it was drawn. */
  bearing: number;
  /** Middle of the building. */
  center: LngLat;
  /** Width and depth of the building in metres, as seen with the plan upright. */
  size: [width: number, depth: number];
  levels: IndoorLevel[];
  /** The floor of each level, drawn under its walls. */
  slabs: FeatureCollection<Polygon, IndoorLevelProperties>;
  /** All wall lines of a level as one feature. */
  walls: FeatureCollection<MultiLineString, IndoorLevelProperties>;
};

export type IndoorSlab = Feature<Polygon, IndoorLevelProperties>;
