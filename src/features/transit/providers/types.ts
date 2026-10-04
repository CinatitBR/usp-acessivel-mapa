import type { Arrival, BusStop } from '../../../domain/types';

/** Something that can say when buses reach a stop. Implementations sit behind `withFallback`. */
export interface ArrivalsProvider {
  id: string;
  getArrivals(stop: BusStop, signal: AbortSignal): Promise<Arrival[]>;
}

/** How many arrivals a stop panel shows. */
export const MAX_ARRIVALS = 12;
