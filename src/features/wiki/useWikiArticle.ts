import { useQuery } from '@tanstack/react-query';
import type { WikiRef } from '../../domain/types';
import { fetchWikiArticle } from './providers/wikipedia';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Wikipedia article of a campus object, fetched when a panel first needs
 * it and then kept for a day: most buildings share their institute's article,
 * so opening one after another must not ask Wikipedia again.
 */
export function useWikiArticle(ref: WikiRef | undefined) {
  return useQuery({
    queryKey: ['wiki', ref],
    queryFn: async ({ signal }) => (await fetchWikiArticle(ref!, signal)) ?? null,
    enabled: ref !== undefined,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
