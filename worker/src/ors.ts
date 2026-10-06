import { UpstreamError } from './olhovivo';
import { blockingPositions } from './reportsDb';
import type { OrsProfile } from './routes';

const API = 'https://api.openrouteservice.org/v2/directions';
const UPSTREAM_TIMEOUT_MS = 10_000;
/** The same two places give the same route for a while, and each call counts against a daily quota. */
export const ORS_ROUTE_TTL_SECONDS = 300;

/** Synthetic Cache API key (see olhovivo.ts): one entry per profile, pair of points and set of reports gone around. */
const routeKey = (profile: OrsProfile, from: string, to: string, avoided: readonly string[]) =>
  `https://ors.internal/${profile}/${from}/${to}/${avoided.join(',')}`;

/**
 * How far around a report the route keeps away, in metres. Chosen by the user after a trial
 * (REPORTS_PLAN.md): tight enough to leave a parallel sidewalk open, so a pin placed further
 * than this from its path is warned about but not gone around.
 */
export const AVOID_RADIUS_METERS = 8;
const CIRCLE_SIDES = 12;
const METERS_PER_DEGREE = 111_320;

/** The areas to keep out of, as GeoJSON: one small many-sided ring around each point. */
export function avoidPolygons(points: readonly (readonly [lng: number, lat: number])[], radius = AVOID_RADIUS_METERS) {
  const rings = points.map(([lng, lat]) => {
    const perLng = METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
    const ring = Array.from({ length: CIRCLE_SIDES }, (_, index) => {
      const angle = (2 * Math.PI * index) / CIRCLE_SIDES;
      return [Number((lng + (radius * Math.cos(angle)) / perLng).toFixed(6)), Number((lat + (radius * Math.sin(angle)) / METERS_PER_DEGREE).toFixed(6))];
    });
    return [[...ring, ring[0]!]];
  });
  return { type: 'MultiPolygon' as const, coordinates: rings };
}

const toPosition = (point: string) => point.split(',').map(Number);

/**
 * Asks openrouteservice for one walking route between two validated points and
 * returns its GeoJSON text unchanged. The request body is built here, so
 * callers can choose nothing but the profile, the two points and which reports to go around.
 * Those are named by id: where they are comes from the database, and only published reports
 * that say one cannot get through count, so nobody can bend a route with a report of their own.
 */
export async function orsRoute(
  profile: OrsProfile,
  from: string,
  to: string,
  avoid: readonly string[],
  env: Env,
  ctx: ExecutionContext,
): Promise<string> {
  const blocks = profile === 'wheelchair' && avoid.length > 0 ? await blockingPositions(env.DB, avoid) : [];
  const key = routeKey(profile, from, to, blocks.map(({ id }) => id));
  const cached = await caches.default.match(key);
  if (cached) return cached.text();
  if (!env.ORS_API_KEY) throw new UpstreamError('auth', 502);

  try {
    const response = await fetch(`${API}/${profile}/geojson`, {
      method: 'POST',
      headers: { Authorization: env.ORS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [toPosition(from), toPosition(to)],
        language: 'pt',
        instructions: true,
        // Lets the app mark the stretches that are stairs.
        extra_info: ['waytype'],
        ...(profile === 'wheelchair' && {
          options: {
            avoid_features: ['steps'],
            ...(blocks.length > 0 && { avoid_polygons: avoidPolygons(blocks.map(({ at }) => at)) }),
            profile_params: { restrictions: { maximum_incline: 6, maximum_sloped_kerb: 0.06 } },
          },
        }),
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    // 429 is the per-minute limit; 403 is what an exhausted daily quota returns.
    if (response.status === 429 || response.status === 403) throw new UpstreamError('rate_limited', 429);
    if (response.status === 401) throw new UpstreamError('auth', 502);
    // With areas to keep out of, there may be no way left between the two points.
    if (response.status === 404 && blocks.length > 0) throw new UpstreamError('no_route', 404);
    if (!response.ok) throw new UpstreamError('upstream', 502);

    // One route between two nearby points: a small, bounded document.
    const body = await response.text();
    ctx.waitUntil(
      caches.default.put(
        key,
        new Response(body, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ORS_ROUTE_TTL_SECONDS}` },
        }),
      ),
    );
    return body;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new UpstreamError(timedOut ? 'timeout' : 'upstream', timedOut ? 504 : 502);
  }
}
