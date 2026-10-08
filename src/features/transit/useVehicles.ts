import { useQuery } from '@tanstack/react-query';
import type { LineDirection } from '../../domain/types';
import { olhoVivoVehicles } from './providers/olhovivo';

const POLL_MS = 20_000;
/** Without a good answer for this long, the buses on the map are too old to show. */
export const FEED_LOST_MS = 60_000;

/**
 * True when live positions should be given up on: the last request failed and
 * the last good answer is old, or there never was one. A single missed poll is
 * not enough, so the buses do not vanish over one slow request.
 */
export function feedLost({ isError, dataUpdatedAt, now }: { isError: boolean; dataUpdatedAt: number; now: number }): boolean {
  return isError && now - dataUpdatedAt > FEED_LOST_MS;
}

/**
 * Positions of every bus on the tracked lines, refreshed every 20 s while the
 * tab is visible. There is no fallback provider: Transitous has no positions.
 * A failed request is tried once more; the last positions stay in `data` meanwhile.
 */
export function useVehicles(lines: LineDirection[]) {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: ({ signal }) => olhoVivoVehicles.getVehicles(lines, signal),
    enabled: lines.some((line) => line.code !== undefined || line.loopCode !== undefined),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS / 2,
    retry: 1,
    retryDelay: 2_000,
  });
}
