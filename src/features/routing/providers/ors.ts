import { API_BASE } from '../../../config';
import type { LngLat, Route, RouteProfile, RouteStep } from '../../../domain/types';
import { fetchJson, ProviderError } from '../../../lib/http';
import type { RoutingProvider } from './types';

const PROVIDER = 'ors';
/** Value of the `waytype` extra for stairs (openrouteservice documentation, "Extra info"). */
const WAYTYPE_STEPS = 8;

type OrsStep = { instruction?: unknown; distance?: unknown; way_points?: unknown };
type OrsFeature = {
  geometry?: { type?: unknown; coordinates?: unknown };
  properties?: {
    summary?: { distance?: unknown; duration?: unknown };
    segments?: { steps?: OrsStep[] }[];
    /** Runs of `[fromIndex, toIndex, waytype]` over the geometry. */
    extras?: { waytype?: { values?: unknown } };
  };
};

function stairRuns(feature: OrsFeature): [number, number][] {
  const values = feature.properties?.extras?.waytype?.values;
  if (!Array.isArray(values)) return [];
  return (values as unknown[])
    .filter((run): run is [number, number, number] => Array.isArray(run) && run[2] === WAYTYPE_STEPS)
    .map(([from, to]) => [from, to]);
}

/** Converts a `/v2/directions/{profile}/geojson` response into a route. */
export function parseOrsRoute(json: unknown, profile: RouteProfile): Route {
  const feature = (json as { features?: OrsFeature[] } | null)?.features?.[0];
  const coordinates = feature?.geometry?.type === 'LineString' ? feature.geometry.coordinates : undefined;
  const summary = feature?.properties?.summary;
  if (!feature || !Array.isArray(coordinates) || coordinates.length < 2
    || typeof summary?.distance !== 'number' || typeof summary.duration !== 'number') {
    throw new ProviderError(PROVIDER, 'parse', 'no route in response');
  }
  // Positions may carry an elevation as a third number.
  const geometry = (coordinates as number[][]).map(([lng, lat]): LngLat => [lng!, lat!]);

  const stairs = stairRuns(feature);
  const steps: RouteStep[] = [];
  for (const step of feature.properties?.segments?.flatMap((segment) => segment.steps ?? []) ?? []) {
    const [from, to] = Array.isArray(step.way_points) ? (step.way_points as number[]) : [];
    if (typeof step.instruction !== 'string' || from === undefined || to === undefined) continue;
    // The last step is the arrival: no length.
    if (from === to) continue;
    const hasSteps = stairs.some(([start, end]) => start < to && end > from);
    steps.push({
      instruction: step.instruction,
      distance: typeof step.distance === 'number' ? step.distance : 0,
      ...(hasSteps && { hasSteps }),
      from,
      to,
    });
  }

  const anyStairs = steps.some((step) => step.hasSteps);
  return {
    provider: PROVIDER,
    profile,
    // The wheelchair profile never uses stairs; the Worker also asks it to avoid them.
    stepFree: profile === 'wheelchair' && !anyStairs ? 'guaranteed' : 'no',
    geometry,
    distance: summary.distance,
    duration: summary.duration,
    steps,
  };
}

const point = ([lng, lat]: LngLat) => `${lng.toFixed(5)},${lat.toFixed(5)}`;

/** openrouteservice, reached through the Worker, which holds the API key. */
export const orsRouting: RoutingProvider = {
  id: PROVIDER,
  async route({ from, to, profile }, signal) {
    if (!API_BASE) throw new ProviderError(PROVIDER, 'network', 'no API base configured');
    const orsProfile = profile === 'wheelchair' ? 'wheelchair' : 'foot-walking';
    const url = `${API_BASE}/ors/route?profile=${orsProfile}&from=${point(from)}&to=${point(to)}`;
    return parseOrsRoute(await fetchJson(url, { provider: PROVIDER, signal, timeoutMs: 12_000 }), profile);
  },
};
