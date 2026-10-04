export const STYLE_URL = `${import.meta.env.BASE_URL}styles/campus.json`;

/** Centre of OSM relation 20199272 (Cidade Universitária Armando de Salles Oliveira). */
export const CAMPUS_CENTER = { longitude: -46.7283, latitude: -23.5611 };

/** Bounding box of the campus boundary relation: [west, south, east, north]. */
export const CAMPUS_BBOX = [-46.7441, -23.5728, -46.7125, -23.5494] as const;

/** Camera limits: the campus plus Metrô Butantã, where the circular lines end. */
export const MAP_MAX_BOUNDS: [west: number, south: number, east: number, north: number] = [
  -46.775, -23.592, -46.688, -23.532,
];

/**
 * Base URL of the Cloudflare Worker, without a trailing slash. In dev it
 * defaults to `/api`, which Vite proxies to the local Worker (vite.config.ts).
 * A production build needs VITE_API_BASE; without it live data is skipped.
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') || (import.meta.env.DEV ? '/api' : '');

/** Sent as `X-Client-Id` to public services, so their operators can identify the app. */
export const CLIENT_ID = (import.meta.env.VITE_CLIENT_ID as string | undefined) || 'usp-campus-map';

/** From this zoom on, buses are 3D models; below it (and always in lite mode) they are flat markers. */
export const BUS_3D_MIN_ZOOM = 15.5;

/** Trees are only drawn from this zoom on. */
export const TREE_MIN_ZOOM = 15;

export const INITIAL_ZOOM = 15.5;
/** Tilted by default so building extrusions read as 3D. */
export const INITIAL_PITCH = 50;
export const MIN_ZOOM = 13;
export const MAX_PITCH = 70;
