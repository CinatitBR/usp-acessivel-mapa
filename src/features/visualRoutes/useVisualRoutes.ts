import { useQuery } from '@tanstack/react-query';
import { CAMPUS_API_BASE, CAMPUS_STORAGE_BASE } from '../../config';
import { fetchJson } from '../../lib/http';
import { parseVisualRoutes } from './parse';

/** Routes are sent in by people now and then; one request serves a visit to a unit's buildings. */
const STALE_MS = 5 * 60_000;

/**
 * The visual routes of a university unit, by its id in the campus backend. Asked for only
 * when the building belongs to a unit the backend knows.
 */
export function useVisualRoutes(unit: string | undefined) {
  return useQuery({
    queryKey: ['visualRoutes', unit],
    queryFn: async ({ signal }) =>
      parseVisualRoutes(
        await fetchJson(`${CAMPUS_API_BASE}/buildings/${encodeURIComponent(unit!)}/accessibility`, { provider: 'campus', signal }),
        CAMPUS_STORAGE_BASE,
      ),
    enabled: unit !== undefined,
    staleTime: STALE_MS,
    retry: 1,
  });
}
