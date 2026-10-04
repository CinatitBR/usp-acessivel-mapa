import { CLIENT_ID } from '../../../config';
import type { Route, RouteProfile, RouteStep } from '../../../domain/types';
import { fetchJson, ProviderError } from '../../../lib/http';
import { strings } from '../../../strings/pt-BR';
import { decodePolyline } from '../polyline';
import type { RouteRequest, RoutingProvider } from './types';

const PROVIDER = 'valhalla';
/** Public server run by FOSSGIS; fair use asks for an identifying header and few requests. */
const URL = 'https://valhalla1.openstreetmap.de/route';
const MIN_INTERVAL_MS = 1_000;

/** Valhalla maneuver types (see its API reference). */
const MANEUVER_STEPS = 40;
const MANEUVER_DESTINATIONS = new Set([4, 5, 6]);

type ValhallaManeuver = {
  type?: unknown;
  instruction?: unknown;
  length?: unknown;
  begin_shape_index?: unknown;
  end_shape_index?: unknown;
};
type ValhallaResponse = {
  trip?: {
    summary?: { length?: unknown; time?: unknown };
    legs?: { shape?: unknown; maneuvers?: ValhallaManeuver[] }[];
  };
};

/** Converts a `/route` response (kilometres, one leg) into a route. */
export function parseValhallaRoute(json: unknown, profile: RouteProfile): Route {
  const trip = (json as ValhallaResponse | null)?.trip;
  const leg = trip?.legs?.[0];
  const geometry = typeof leg?.shape === 'string' ? decodePolyline(leg.shape) : [];
  if (!trip || geometry.length < 2 || typeof trip.summary?.length !== 'number' || typeof trip.summary.time !== 'number') {
    throw new ProviderError(PROVIDER, 'parse', 'no route in response');
  }

  const last = geometry.length - 1;
  const steps: RouteStep[] = [];
  for (const maneuver of leg?.maneuvers ?? []) {
    if (typeof maneuver.instruction !== 'string' || typeof maneuver.type !== 'number') continue;
    const hasSteps = maneuver.type === MANEUVER_STEPS;
    // The arrival line carries no distance and reads oddly in a short list.
    if (MANEUVER_DESTINATIONS.has(maneuver.type)) continue;
    const from = typeof maneuver.begin_shape_index === 'number' ? Math.min(maneuver.begin_shape_index, last) : 0;
    const to = typeof maneuver.end_shape_index === 'number' ? Math.min(maneuver.end_shape_index, last) : from;
    steps.push({
      // Valhalla has no Portuguese text for stairs and falls back to English.
      instruction: hasSteps ? strings.route.takeStairs : maneuver.instruction,
      distance: typeof maneuver.length === 'number' ? maneuver.length * 1000 : 0,
      ...(hasSteps && { hasSteps }),
      from,
      to,
    });
  }

  return {
    provider: PROVIDER,
    profile,
    // Valhalla can make stairs very costly but cannot forbid them.
    stepFree: profile === 'wheelchair' ? 'best-effort' : 'no',
    geometry,
    distance: trip.summary.length * 1000,
    duration: trip.summary.time,
    steps,
  };
}

export function valhallaRequestBody({ from, to, profile }: RouteRequest) {
  return {
    locations: [
      { lon: from[0], lat: from[1] },
      { lon: to[0], lat: to[1] },
    ],
    costing: 'pedestrian',
    ...(profile === 'wheelchair' && {
      costing_options: { pedestrian: { type: 'wheelchair', step_penalty: 3600, max_grade: 8 } },
    }),
    directions_options: { language: 'pt-BR', units: 'kilometers' },
  };
}

let lastRequestAt = 0;

/** Keeps requests to the shared public server at least a second apart. */
async function throttle(signal: AbortSignal) {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  lastRequestAt = Date.now() + Math.max(wait, 0);
  if (wait <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    }, { once: true });
  });
}

export const valhallaRouting: RoutingProvider = {
  id: PROVIDER,
  async route(request, signal) {
    await throttle(signal);
    const json = await fetchJson(URL, {
      provider: PROVIDER,
      signal,
      timeoutMs: 12_000,
      headers: { 'X-Client-Id': CLIENT_ID },
      body: valhallaRequestBody(request),
    });
    return parseValhallaRoute(json, request.profile);
  },
};
