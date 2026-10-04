export const STYLE_URL = `${import.meta.env.BASE_URL}styles/campus.json`;

/** Centre of OSM relation 20199272 (Cidade Universitária Armando de Salles Oliveira). */
export const CAMPUS_CENTER = { longitude: -46.7283, latitude: -23.5611 };

/** Bounding box of the campus boundary relation: [west, south, east, north]. */
export const CAMPUS_BBOX = [-46.7441, -23.5728, -46.7125, -23.5494] as const;

/** Camera limits: the campus plus Metrô Butantã, where the circular lines end. */
export const MAP_MAX_BOUNDS: [west: number, south: number, east: number, north: number] = [
  -46.775, -23.592, -46.688, -23.532,
];

export const INITIAL_ZOOM = 15.5;
/** Tilted by default so building extrusions read as 3D. */
export const INITIAL_PITCH = 50;
export const MIN_ZOOM = 13;
export const MAX_PITCH = 70;
