import { useEffect, useMemo, useState } from 'react';
import type { GeocodeResult } from '../../domain/types';
import type { SearchFn } from './engine';
import { PHOTON_DEBOUNCE_MS, PHOTON_MIN_CHARS, searchPhoton } from './photon';

/** Off-campus results, only while online. Any failure just leaves the section empty. */
function usePhoton(query: string): GeocodeResult[] {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  useEffect(() => {
    setResults([]);
    if (query.length < PHOTON_MIN_CHARS || !navigator.onLine) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPhoton(query, controller.signal).then(setResults, () => undefined);
    }, PHOTON_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return results;
}

/**
 * Places that match what is being typed: the campus first, from its own index, then the
 * world outside it while `remoteOn`. The index is loaded on the first call of `ensureIndex`.
 */
export function usePlaceSearch(text: string, remoteOn: boolean) {
  const [search, setSearch] = useState<SearchFn | null>(null);
  const [failed, setFailed] = useState(false);
  const query = text.trim();
  const local = useMemo(() => (search && query ? search(query) : []), [search, query]);
  const remote = usePhoton(remoteOn ? query : '');

  const ensureIndex = () => {
    if (search) return;
    setFailed(false);
    import('./load')
      .then((module) => module.loadSearch())
      .then((fn) => setSearch(() => fn), () => setFailed(true));
  };

  /** What to say while there is nothing from the campus to show. */
  const note = failed ? 'failed' : search ? 'none' : 'loading';
  return { query, local, remote, results: [...local, ...remote], note, ensureIndex } as const;
}
