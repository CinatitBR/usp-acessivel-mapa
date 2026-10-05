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

export const ROOM_CATEGORIES = [
  'classroom',
  'studio',
  'laboratory',
  'library',
  'museum',
  'auditorium',
  'administration',
  'department',
  'food',
  'services',
  'bathroom',
  'hall',
  'circulation',
  'ramp',
  'stairs',
  'elevator',
  'void',
  'technical',
] as const;
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

export type IndoorRoomProperties = {
  /** Unique within the plan. */
  id: string;
  level: number;
  name: string;
  cat: RoomCategory;
  /** Square metres, rounded: larger rooms get their name first. */
  area: number;
};

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
  /** Rooms of every level, in drawing order: a later room lies over an earlier one. */
  rooms: FeatureCollection<Polygon, IndoorRoomProperties>;
};

export type IndoorSlab = Feature<Polygon, IndoorLevelProperties>;
