import { UpstreamError } from './olhovivo';
import type { OrsProfile } from './routes';

const API = 'https://api.openrouteservice.org/v2/directions';
const UPSTREAM_TIMEOUT_MS = 10_000;
/** The same two places give the same route for a while, and each call counts against a daily quota. */
export const ORS_ROUTE_TTL_SECONDS = 300;

/** Synthetic Cache API key (see olhovivo.ts): one entry per profile and pair of points. */
const routeKey = (profile: OrsProfile, from: string, to: string) => `https://ors.internal/${profile}/${from}/${to}`;

const toPosition = (point: string) => point.split(',').map(Number);

/**
 * Asks openrouteservice for one walking route between two validated points and
 * returns its GeoJSON text unchanged. The request body is built here, so
 * callers can choose nothing but the profile and the two points.
 */
export async function orsRoute(
  profile: OrsProfile,
  from: string,
  to: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<string> {
  const key = routeKey(profile, from, to);
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
            profile_params: { restrictions: { maximum_incline: 6, maximum_sloped_kerb: 0.06 } },
          },
        }),
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    // 429 is the per-minute limit; 403 is what an exhausted daily quota returns.
    if (response.status === 429 || response.status === 403) throw new UpstreamError('rate_limited', 429);
    if (response.status === 401) throw new UpstreamError('auth', 502);
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
