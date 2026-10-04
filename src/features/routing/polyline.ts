import type { LngLat } from '../../domain/types';

/**
 * Decodes an encoded polyline (the Google algorithm) into `[lng, lat]` pairs.
 * Valhalla uses 6 decimal places; the original format uses 5.
 */
export function decodePolyline(encoded: string, precision = 6): LngLat[] {
  const factor = 10 ** precision;
  const points: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const next = (): number | undefined => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return undefined;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    // A truncated string ends the line at the last complete point.
    if (dLat === undefined || dLng === undefined) break;
    lat += dLat;
    lng += dLng;
    points.push([lng / factor, lat / factor]);
  }
  return points;
}
