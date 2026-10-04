import { useQuery } from '@tanstack/react-query';
import type { Arrival, BusStop } from '../../domain/types';
import { withFallback } from '../../lib/fallback';
import { olhoVivoArrivals } from './providers/olhovivo';
import { transitousArrivals } from './providers/transitous';

/** Live first; the timetable only when live data is unavailable or has nothing for this stop. */
const PROVIDERS = [olhoVivoArrivals, transitousArrivals];
const POLL_MS = 20_000;

export type StopArrivals = {
  arrivals: Arrival[];
  /** False when Olho Vivo (or the Worker) could not be reached, as opposed to answering with no buses. */
  liveReachable: boolean;
};

/**
 * Arrivals for one stop, refreshed every 20 s while the panel is open and the
 * tab is visible (TanStack Query pauses interval refetching in the background).
 */
export function useArrivals(stop: BusStop) {
  return useQuery({
    queryKey: ['arrivals', stop.id],
    queryFn: async ({ signal }): Promise<StopArrivals> => {
      const { value, failed } = await withFallback(
        PROVIDERS,
        (candidate) => candidate.getArrivals(stop, signal),
        (arrivals) => arrivals.length > 0,
      );
      return { arrivals: value, liveReachable: !failed.includes(olhoVivoArrivals.id) };
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS / 2,
    // The fallback chain already is the retry strategy.
    retry: false,
  });
}
