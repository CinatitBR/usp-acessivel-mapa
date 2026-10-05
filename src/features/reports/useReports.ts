import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { API_BASE } from '../../config';
import { isActive, type Report } from '../../domain/reports';
import { fetchJson } from '../../lib/http';
import { parseReports } from './parse';
import { today } from './today';

/** A report shows for everyone within this long of being published. */
const POLL_MS = 2 * 60_000;
const NONE: Report[] = [];

/**
 * The published reports that are in force today, refreshed every two minutes. Without the
 * Worker, or when it cannot be reached, there are none: the rest of the map does not depend on them.
 */
export function useReports(): Report[] {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['reports'],
    queryFn: async ({ signal }) => parseReports(await fetchJson(`${API_BASE}/reports`, { provider: 'reports', signal })),
    enabled: API_BASE !== '',
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS / 2,
  });
  // Expiry is judged again on every refresh, so a report ends on its day even if the list did not change.
  return useMemo(() => {
    const day = today(new Date(dataUpdatedAt || Date.now()));
    return data ? data.filter((report) => isActive(report, day)) : NONE;
  }, [data, dataUpdatedAt]);
}
