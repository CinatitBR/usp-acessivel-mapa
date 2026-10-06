import type { Report } from '../../domain/reports';
import type { Route } from '../../domain/types';
import { nearestOnLine, ON_ROUTE_METERS } from '../reports/onRoute';

export type Detour = {
  /** How many reports the route now goes around. */
  avoided: number;
  /** Metres the route is longer than the usual one; can be zero or a little less. */
  extra: number;
};

export type DetourResult = { route: Route; detour?: Detour; noDetour?: boolean };

/** A way around can run into another report; after this many tries the route is taken as it is. */
const MAX_ROUNDS = 2;

/** The reports that say one cannot get through a passage, a step or a sidewalk: the only ones a route goes around. */
export const isBlocking = ({ type, answer }: Report) => answer === 'no' && (type === 'blocked' || type === 'step' || type === 'narrow');

const onRoute = (route: Route, reports: readonly Report[]) =>
  reports.filter((report) => nearestOnLine(report.position, route.geometry).distance <= ON_ROUTE_METERS);

/**
 * A step-free route that goes around the blocking reports on the usual one, if there is such
 * a route. `routeAvoiding` asks for a route that keeps away from the reports with the given
 * ids. When it finds none, the usual route comes back with `noDetour`; when going around
 * changes nothing (the pin is too far from its path to cut it), the usual route comes back
 * plain, and its warnings say the rest.
 */
export async function findDetour(usual: Route, blocking: readonly Report[], routeAvoiding: (ids: string[]) => Promise<Route>): Promise<DetourResult> {
  const avoid = new Set<string>();
  let route = usual;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const met = onRoute(route, blocking).filter(({ id }) => !avoid.has(id));
    if (met.length === 0) break;
    for (const { id } of met) avoid.add(id);
    try {
      route = await routeAvoiding([...avoid].sort());
    } catch (error) {
      // A cancelled request is not a missing route.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return { route: usual, noDetour: true };
    }
  }
  const still = new Set(onRoute(route, blocking).map(({ id }) => id));
  const avoided = [...avoid].filter((id) => !still.has(id)).length;
  return avoided === 0 ? { route: usual } : { route, detour: { avoided, extra: route.distance - usual.distance } };
}
