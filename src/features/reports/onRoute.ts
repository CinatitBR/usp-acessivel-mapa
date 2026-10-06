import type { Report } from '../../domain/reports';
import type { LngLat, RouteProfile } from '../../domain/types';

/** A report the route passes, or one about the place it leads to. */
export type RouteWarning = {
  report: Report;
  /** Metres from the start of the route to the point nearest the report. */
  along: number;
  /** About the destination itself (its elevator, its accessible toilet), not something on the way. */
  atDestination: boolean;
};

/** A pin is rarely exactly on the path it is about. */
export const ON_ROUTE_METERS = 12;
/** A report about an elevator or a toilet counts for a destination this close to it, when it names no building. */
const AT_DESTINATION_METERS = 25;
const METERS_PER_DEGREE = 111_320;

type Destination = { position: LngLat; buildingId?: string };

/** Which reports matter on the way, by kind of route. On foot only a passage that cannot be passed does. */
const onTheWay = (report: Report, profile: RouteProfile) =>
  profile === 'wheelchair' ? report.type === 'blocked' || report.type === 'step' || report.type === 'narrow' : report.type === 'blocked' && report.answer === 'no';

/** Distance from a point to the line, and how far along the line its nearest point is, in metres. */
export function nearestOnLine(point: LngLat, line: readonly LngLat[]): { distance: number; along: number } {
  const perLng = METERS_PER_DEGREE * Math.cos((point[1] * Math.PI) / 180);
  const flat = ([lng, lat]: LngLat): [number, number] => [(lng - point[0]) * perLng, (lat - point[1]) * METERS_PER_DEGREE];
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let index = 1; index < line.length; index++) {
    const [ax, ay] = flat(line[index - 1]!);
    const [bx, by] = flat(line[index]!);
    const [dx, dy] = [bx - ax, by - ay];
    const length = Math.hypot(dx, dy);
    // Where the point falls on this stretch, from 0 at its start to 1 at its end.
    const share = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (length * length)));
    const distance = Math.hypot(ax + share * dx, ay + share * dy);
    if (distance < best.distance) best = { distance, along: walked + share * length };
    walked += length;
  }
  return best;
}

/**
 * The reports that concern a route, in the order they are met, then those about the
 * destination. `buildingOf` gives the building a report belongs to, if any. Nothing here
 * says a route is clear: reports exist only where someone passed and took the trouble.
 */
export function reportsOnRoute(
  line: readonly LngLat[],
  profile: RouteProfile,
  reports: readonly Report[],
  destination: Destination,
  buildingOf: (report: Report) => string | undefined = () => undefined,
): RouteWarning[] {
  if (line.length < 2) return [];
  const warnings: RouteWarning[] = [];
  for (const report of reports) {
    const { distance, along } = nearestOnLine(report.position, line);
    if (onTheWay(report, profile)) {
      if (distance <= ON_ROUTE_METERS) warnings.push({ report, along, atDestination: false });
    } else if (profile === 'wheelchair' && (report.type === 'elevator' || report.type === 'toilet')) {
      const building = buildingOf(report);
      const sameBuilding = building !== undefined && building === destination.buildingId;
      const near = building === undefined && nearestOnLine(report.position, [destination.position, destination.position]).distance <= AT_DESTINATION_METERS;
      if (sameBuilding || near) warnings.push({ report, along, atDestination: true });
    }
  }
  return warnings.sort((a, b) => Number(a.atDestination) - Number(b.atDestination) || a.along - b.along);
}
