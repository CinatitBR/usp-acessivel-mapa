import type { Arrival } from '../../../domain/types';
import { fetchJson } from '../../../lib/http';
import { type ArrivalsProvider, MAX_ARRIVALS } from './types';

const PROVIDER = 'transitous';
const ENDPOINT = 'https://api.transitous.org/api/v1/stoptimes';
/** Transitous prefixes each feed's stop ids; the SPTrans GTFS is `br-sao-paulo`. */
const FEED_PREFIX = 'br-sao-paulo_';

type StopTime = {
  place?: { departure?: unknown; scheduledDeparture?: unknown; arrival?: unknown };
  routeShortName?: unknown;
  headsign?: unknown;
  realTime?: unknown;
};

/**
 * Converts a MOTIS `stoptimes` response. São Paulo has no realtime feed in
 * Transitous, so these are timetable times; `realTime` is honoured in case
 * that changes.
 */
export function parseTransitousArrivals(json: unknown, now: number): Arrival[] {
  const stopTimes = (json as { stopTimes?: StopTime[] } | null)?.stopTimes;
  if (!Array.isArray(stopTimes)) return [];

  const arrivals: Arrival[] = [];
  for (const stopTime of stopTimes) {
    const iso = stopTime.place?.departure ?? stopTime.place?.scheduledDeparture ?? stopTime.place?.arrival;
    const time = typeof iso === 'string' ? Date.parse(iso) : NaN;
    if (!Number.isFinite(time) || time < now - 60_000 || typeof stopTime.routeShortName !== 'string') continue;
    arrivals.push({
      lineId: stopTime.routeShortName,
      headsign: typeof stopTime.headsign === 'string' ? stopTime.headsign : '',
      time,
      source: stopTime.realTime === true ? 'live' : 'scheduled',
    });
  }
  return arrivals.sort((a, b) => a.time - b.time);
}

/** Scheduled departures from Transitous: the fallback when Olho Vivo or the Worker is unavailable. */
export const transitousArrivals: ArrivalsProvider = {
  id: PROVIDER,
  async getArrivals(stop, signal) {
    const params = new URLSearchParams({ stopId: `${FEED_PREFIX}${stop.id}`, n: String(MAX_ARRIVALS * 2) });
    return parseTransitousArrivals(
      await fetchJson(`${ENDPOINT}?${params}`, { provider: PROVIDER, signal, timeoutMs: 10_000 }),
      Date.now(),
    );
  },
};
