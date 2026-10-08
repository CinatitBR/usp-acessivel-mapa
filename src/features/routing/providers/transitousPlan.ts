import type { Journey, JourneyLeg, JourneyPlace, LngLat } from '../../../domain/types';
import { fetchJson } from '../../../lib/http';
import { decodePolyline } from '../polyline';

const PROVIDER = 'transitous';
const ENDPOINT = 'https://api.transitous.org/api/v5/plan';
/** The modes that run on a road; every other vehicle is shown as a train. */
const ROAD_MODES = new Set(['BUS', 'COACH']);

type Place = { name?: unknown; lat?: unknown; lon?: unknown; arrival?: unknown; departure?: unknown; stopId?: unknown };
type Leg = {
  mode?: unknown;
  from?: Place;
  to?: Place;
  startTime?: unknown;
  endTime?: unknown;
  distance?: unknown;
  legGeometry?: { points?: unknown; precision?: unknown };
  displayName?: unknown;
  routeShortName?: unknown;
  headsign?: unknown;
  routeColor?: unknown;
  routeTextColor?: unknown;
  intermediateStops?: Place[];
};
type Itinerary = { startTime?: unknown; endTime?: unknown; transfers?: unknown; legs?: Leg[] };

const time = (iso: unknown): number => (typeof iso === 'string' ? Date.parse(iso) : NaN);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
/** A GTFS colour is six hex digits without the `#`; anything else is left out. */
const color = (value: unknown): string | undefined => (typeof value === 'string' && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : undefined);

function place(raw: Place | undefined, at: unknown, name = text(raw?.name)): JourneyPlace | null {
  const when = time(at);
  if (typeof raw?.lat !== 'number' || typeof raw.lon !== 'number' || !Number.isFinite(when)) return null;
  return { name, position: [raw.lon, raw.lat], time: when };
}

function geometry(raw: Leg['legGeometry'], from: LngLat, to: LngLat): LngLat[] {
  const points = typeof raw?.points === 'string' ? decodePolyline(raw.points, typeof raw.precision === 'number' ? raw.precision : 6) : [];
  // A leg without a drawn path is still a leg: a straight line stands in for it.
  return points.length > 1 ? points : [from, to];
}

/** `ownStart` and `ownEnd`: the leg begins or ends at the journey's own end, which MOTIS calls START and END. */
function leg(raw: Leg, ownStart: boolean, ownEnd: boolean): JourneyLeg | null {
  const from = place(raw.from, raw.startTime, ownStart ? '' : undefined);
  const to = place(raw.to, raw.endTime, ownEnd ? '' : undefined);
  if (!from || !to) return null;
  const base = { from, to, geometry: geometry(raw.legGeometry, from.position, to.position) };
  if (raw.mode === 'WALK') return { ...base, kind: 'walk', distance: typeof raw.distance === 'number' ? raw.distance : 0 };

  const line = text(raw.routeShortName) || text(raw.displayName);
  if (typeof raw.mode !== 'string' || !line) return null;
  const stops = (Array.isArray(raw.intermediateStops) ? raw.intermediateStops : []).flatMap((stop) => place(stop, stop.arrival ?? stop.departure) ?? []);
  const lineColor = color(raw.routeColor);
  const textColor = color(raw.routeTextColor);
  return {
    ...base,
    kind: 'transit',
    vehicle: ROAD_MODES.has(raw.mode) ? 'bus' : 'rail',
    line,
    headsign: text(raw.headsign),
    // The text colour only makes sense on the line's own colour.
    ...(lineColor && { color: lineColor, ...(textColor && { textColor }) }),
    stops,
  };
}

/**
 * Converts a MOTIS `plan` response into journeys, soonest first. A journey with a leg that cannot
 * be read is left out rather than shown with a gap. São Paulo has no realtime feed in Transitous,
 * so the times are timetable times.
 */
export function parseTransitousPlan(json: unknown): Journey[] {
  const itineraries = (json as { itineraries?: Itinerary[] } | null)?.itineraries;
  if (!Array.isArray(itineraries)) return [];

  const journeys = new Map<string, Journey>();
  for (const itinerary of itineraries) {
    const raw = Array.isArray(itinerary.legs) ? itinerary.legs : [];
    const legs = raw.flatMap((one, index) => leg(one, index === 0, index === raw.length - 1) ?? []);
    const start = time(itinerary.startTime);
    const end = time(itinerary.endTime);
    const rides = legs.flatMap((one) => (one.kind === 'transit' ? [one] : []));
    if (legs.length !== raw.length || rides.length === 0 || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    // The same journey has the same id on every request, so its details stay open when the list is fetched again.
    const id = [start, end, ...rides.map((ride) => `${ride.line}@${ride.from.position.join(',')}`)].join('|');
    if (!journeys.has(id)) {
      journeys.set(id, { id, start, end, transfers: typeof itinerary.transfers === 'number' ? itinerary.transfers : rides.length - 1, legs });
    }
  }
  return [...journeys.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** `time` is when to leave, or when to be there with `arriveBy`; without it the journeys leave from now on. */
export type JourneyRequest = { from: LngLat; to: LngLat; time?: number; arriveBy?: boolean };

/** Journeys by public transport from Transitous, which plans over the timetables of SPTrans, Metrô, CPTM and EMTU. */
export async function planJourneys({ from, to, time: at, arriveBy }: JourneyRequest, signal: AbortSignal): Promise<Journey[]> {
  const params = new URLSearchParams({
    fromPlace: `${from[1]},${from[0]}`,
    toPlace: `${to[1]},${to[0]}`,
    ...(at !== undefined && { time: new Date(at).toISOString() }),
    arriveBy: String(arriveBy === true),
  });
  return parseTransitousPlan(await fetchJson(`${ENDPOINT}?${params}`, { provider: PROVIDER, signal, timeoutMs: 20_000 }));
}
