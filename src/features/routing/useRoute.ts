import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Route, RouteProfile } from '../../domain/types';
import { withFallback } from '../../lib/fallback';
import { ProviderError } from '../../lib/http';
import type { RoutePlan } from '../../state/store';
import { useReports } from '../reports/useReports';
import { type Detour, findDetour, isBlocking } from './detour';
import { orsRouting } from './providers/ors';
import type { RoutingProvider } from './providers/types';
import { valhallaRouting } from './providers/valhalla';

/**
 * Ordinary walking: Valhalla first, as it needs no key or quota. Step-free:
 * openrouteservice first, because only it can exclude stairs outright.
 */
const CHAINS: Record<RouteProfile, RoutingProvider[]> = {
  walk: [valhallaRouting, orsRouting],
  wheelchair: [orsRouting, valhallaRouting],
};

export type RouteResult = {
  route: Route;
  /** openrouteservice refused for lack of quota, so the route came from the fallback. */
  orsOverQuota: boolean;
  /** The step-free route goes around reports that say one cannot get through. */
  detour?: Detour;
  /** Such a report is on the route and there is no way around it. */
  noDetour?: boolean;
};

/**
 * The route for a plan, requested once both ends are set. Setting an end or
 * changing the profile is the explicit action that triggers it; nothing is
 * requested while the map is merely moved. A step-free route from openrouteservice
 * goes around the published reports that say one cannot get through, when it can.
 * A plan by public transport has no walking route: see `useJourneys`.
 */
export function useRoute(plan: RoutePlan | null) {
  const from = plan?.from?.position;
  const to = plan?.to?.position;
  const mode = plan?.mode ?? 'walk';
  const profile: RouteProfile = mode === 'transit' ? 'walk' : mode;
  // Only published reports change a route; a new one makes it be worked out again.
  const published = useReports();
  const blocking = useMemo(() => (profile === 'wheelchair' ? published.filter(isBlocking) : []), [profile, published]);
  const blockingKey = blocking.map(({ id }) => id).join(',');
  return useQuery({
    // Keyed on the mode, so a walking route already worked out never shows as the public transport one.
    queryKey: ['route', mode, from, to, blockingKey],
    enabled: Boolean(from && to) && mode !== 'transit',
    queryFn: async ({ signal }): Promise<RouteResult> => {
      let orsOverQuota = false;
      const { value } = await withFallback(CHAINS[profile], (provider) =>
        provider.route({ from: from!, to: to!, profile }, signal).catch((error: unknown) => {
          if (error instanceof ProviderError && provider.id === 'ors' && error.kind === 'quota') orsOverQuota = true;
          throw error;
        }),
      );
      // Only openrouteservice can keep out of an area; a route from the fallback is left as it is.
      if (value.provider !== 'ors' || blocking.length === 0) return { route: value, orsOverQuota };
      const found = await findDetour(value, blocking, (avoid) => orsRouting.route({ from: from!, to: to!, profile, avoid }, signal));
      return { ...found, orsOverQuota };
    },
    staleTime: 5 * 60_000,
    // The fallback chain already is the retry strategy.
    retry: false,
  });
}
