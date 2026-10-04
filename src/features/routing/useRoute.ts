import { useQuery } from '@tanstack/react-query';
import type { Route } from '../../domain/types';
import { withFallback } from '../../lib/fallback';
import { ProviderError } from '../../lib/http';
import type { RoutePlan } from '../../state/store';
import { orsRouting } from './providers/ors';
import type { RoutingProvider } from './providers/types';
import { valhallaRouting } from './providers/valhalla';

/**
 * Ordinary walking: Valhalla first, as it needs no key or quota. Step-free:
 * openrouteservice first, because only it can exclude stairs outright.
 */
const CHAINS: Record<RoutePlan['profile'], RoutingProvider[]> = {
  walk: [valhallaRouting, orsRouting],
  wheelchair: [orsRouting, valhallaRouting],
};

export type RouteResult = {
  route: Route;
  /** openrouteservice refused for lack of quota, so the route came from the fallback. */
  orsOverQuota: boolean;
};

/**
 * The route for a plan, requested once both ends are set. Setting an end or
 * changing the profile is the explicit action that triggers it; nothing is
 * requested while the map is merely moved.
 */
export function useRoute(plan: RoutePlan | null) {
  const from = plan?.from?.position;
  const to = plan?.to?.position;
  const profile = plan?.profile ?? 'walk';
  return useQuery({
    queryKey: ['route', profile, from, to],
    enabled: Boolean(from && to),
    queryFn: async ({ signal }): Promise<RouteResult> => {
      let orsOverQuota = false;
      const { value } = await withFallback(CHAINS[profile], (provider) =>
        provider.route({ from: from!, to: to!, profile }, signal).catch((error: unknown) => {
          if (error instanceof ProviderError && provider.id === 'ors' && error.kind === 'quota') orsOverQuota = true;
          throw error;
        }),
      );
      return { route: value, orsOverQuota };
    },
    staleTime: 5 * 60_000,
    // The fallback chain already is the retry strategy.
    retry: false,
  });
}
