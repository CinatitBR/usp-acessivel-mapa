import { useQuery } from '@tanstack/react-query';
import type { LineDirection } from '../../domain/types';
import { olhoVivoVehicles } from './providers/olhovivo';

const POLL_MS = 20_000;

/**
 * Positions of every bus on the tracked lines, refreshed every 20 s while the
 * tab is visible. There is no fallback provider: Transitous has no positions.
 */
export function useVehicles(lines: LineDirection[]) {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: ({ signal }) => olhoVivoVehicles.getVehicles(lines, signal),
    enabled: lines.some((line) => line.code !== undefined),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS / 2,
    retry: false,
  });
}
