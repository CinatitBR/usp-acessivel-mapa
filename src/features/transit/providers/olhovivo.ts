import { API_BASE } from '../../../config';
import type { Arrival } from '../../../domain/types';
import { fetchJson, ProviderError } from '../../../lib/http';
import { type ArrivalsProvider, MAX_ARRIVALS } from './types';

const PROVIDER = 'olhovivo';

/** São Paulo has been UTC−3 all year since 2019 (no daylight saving). */
const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type OlhoVivoVehicle = { p?: unknown; t?: unknown; a?: unknown };
type OlhoVivoLine = { c?: unknown; sl?: unknown; lt0?: unknown; lt1?: unknown; vs?: OlhoVivoVehicle[] };
type OlhoVivoStopForecast = { p?: { l?: OlhoVivoLine[] } | null };

/**
 * Olho Vivo gives predictions as local `HH:MM` with no date. This picks the
 * day that puts the time closest to `now`, so a 00:05 prediction read at 23:58
 * lands on the next day.
 */
export function predictionTime(hhmm: string, now: number): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return undefined;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes >= 24 * 60) return undefined;

  const localNow = now + SAO_PAULO_OFFSET_MS;
  const localMidnight = Math.floor(localNow / DAY_MS) * DAY_MS;
  let time = localMidnight + minutes * 60_000 - SAO_PAULO_OFFSET_MS;
  if (time - now > DAY_MS / 2) time -= DAY_MS;
  else if (now - time > DAY_MS / 2) time += DAY_MS;
  return time;
}

const titleCase = (text: string) =>
  text.toLowerCase().replace(/(^|[\s./-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

/**
 * Destination sign for the direction the bus is running: `lt0` in "sentido" 1
 * (main terminal to secondary) and `lt1` in "sentido" 2. Checked against live
 * data and GTFS stop sequences on 2026-10-04 (line 8022-10 towards Metrô Butantã).
 */
function destination(line: OlhoVivoLine): string {
  const sign = line.sl === 2 ? line.lt1 : line.lt0;
  return typeof sign === 'string' ? titleCase(sign.trim()) : '';
}

/** Converts the response of `/Previsao/Parada` into arrivals, soonest first. */
export function parseOlhoVivoArrivals(json: unknown, now: number): Arrival[] {
  const lines = (json as OlhoVivoStopForecast | null)?.p?.l;
  if (!Array.isArray(lines)) return [];

  const arrivals: Arrival[] = [];
  for (const line of lines) {
    if (typeof line.c !== 'string' || !Array.isArray(line.vs)) continue;
    for (const vehicle of line.vs) {
      const time = typeof vehicle.t === 'string' ? predictionTime(vehicle.t, now) : undefined;
      if (time === undefined) continue;
      arrivals.push({
        lineId: line.c.trim(),
        headsign: destination(line),
        time,
        source: 'live',
        ...((typeof vehicle.p === 'string' || typeof vehicle.p === 'number') && { vehicleId: String(vehicle.p) }),
        ...(typeof vehicle.a === 'boolean' && { accessible: vehicle.a }),
      });
    }
  }
  return arrivals.sort((a, b) => a.time - b.time).slice(0, MAX_ARRIVALS);
}

/** Live predictions from SPTrans Olho Vivo, through the Worker that holds the token. */
export const olhoVivoArrivals: ArrivalsProvider = {
  id: PROVIDER,
  async getArrivals(stop, signal) {
    if (!API_BASE) throw new ProviderError(PROVIDER, 'network', 'VITE_API_BASE is not set');
    const url = `${API_BASE}/olhovivo/Previsao/Parada?codigoParada=${encodeURIComponent(stop.id)}`;
    return parseOlhoVivoArrivals(await fetchJson(url, { provider: PROVIDER, signal, timeoutMs: 10_000 }), Date.now());
  },
};
