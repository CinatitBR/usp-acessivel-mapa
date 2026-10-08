import { useQuery } from '@tanstack/react-query';
import type { RoutePlan } from '../../state/store';
import { planJourneys } from './providers/transitousPlan';

/**
 * The journeys by public transport for a plan, requested once both ends are set and that kind of
 * route is chosen. Setting an end or a time is what triggers it. There is one provider and no
 * fallback: the panel says so when it fails.
 */
export function useJourneys(plan: RoutePlan | null) {
  const from = plan?.from?.position;
  const to = plan?.to?.position;
  const time = plan?.time ?? { kind: 'now' };
  return useQuery({
    queryKey: ['journeys', from, to, time.kind, time.kind === 'now' ? null : time.at],
    enabled: Boolean(from && to) && plan?.mode === 'transit',
    queryFn: ({ signal }) =>
      planJourneys({ from: from!, to: to!, ...(time.kind !== 'now' && { time: time.at, arriveBy: time.kind === 'arrive' }) }, signal),
    // Timetables do not change by the minute, but "from now on" does.
    staleTime: time.kind === 'now' ? 60_000 : 5 * 60_000,
    retry: 1,
  });
}
