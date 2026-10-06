import type { LngLat, Route, RouteProfile } from '../../../domain/types';

/** `avoid`: ids of published reports the route should go around, for providers that can. */
export type RouteRequest = { from: LngLat; to: LngLat; profile: RouteProfile; avoid?: readonly string[] };

/** Something that can find a walking route. Implementations sit behind `withFallback`. */
export interface RoutingProvider {
  id: Route['provider'];
  route(request: RouteRequest, signal: AbortSignal): Promise<Route>;
}
