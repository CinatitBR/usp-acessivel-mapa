export const STYLE_URL = `${import.meta.env.BASE_URL}styles/campus.json`;

/** Centre of OSM relation 20199272 (Cidade Universitária Armando de Salles Oliveira). */
export const CAMPUS_CENTER = { longitude: -46.7283, latitude: -23.5611 };

/** Bounding box of the campus boundary relation: [west, south, east, north]. */
export const CAMPUS_BBOX = [-46.7441, -23.5728, -46.7125, -23.5494] as const;

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
/**
 * The camera is not kept to the campus: a route or a journey by public transport may end anywhere
 * in the city, and the map frames all of it. This is far enough out for the whole metropolitan area.
 */
export const MIN_ZOOM = 9;
export const MAX_PITCH = 70;

/**
 * Base URL of the campus backend, which holds the visual routes people sent in, and of the
 * public storage their photos are served from. Both are public addresses, without a trailing slash.
 */
export const CAMPUS_API_BASE =
  (import.meta.env.VITE_CAMPUS_API_BASE as string | undefined)?.replace(/\/+$/, '') || 'https://meu-campus-backend.rochinha.workers.dev';
export const CAMPUS_STORAGE_BASE =
  (import.meta.env.VITE_CAMPUS_STORAGE_BASE as string | undefined)?.replace(/\/+$/, '')
  || 'https://pub-8b8b80176c954365bde513dd3fb34299.r2.dev';
