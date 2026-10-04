import type { LngLat, Route, RouteProfile } from '../../../domain/types';

export type RouteRequest = { from: LngLat; to: LngLat; profile: RouteProfile };

/** Something that can find a walking route. Implementations sit behind `withFallback`. */
export interface RoutingProvider {
  id: Route['provider'];
  route(request: RouteRequest, signal: AbortSignal): Promise<Route>;
}
