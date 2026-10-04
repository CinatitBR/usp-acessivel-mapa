import type { Arrival, BusStop, BusVehicle, LineDirection } from '../../../domain/types';

/** Something that can say when buses reach a stop. Implementations sit behind `withFallback`. */
export interface ArrivalsProvider {
  id: string;
  getArrivals(stop: BusStop, signal: AbortSignal): Promise<Arrival[]>;
}

/** Something that knows where the buses of the given line directions are. */
export interface VehiclesProvider {
  id: string;
  getVehicles(lines: LineDirection[], signal: AbortSignal): Promise<BusVehicle[]>;
}

/** How many arrivals a stop panel shows. */
export const MAX_ARRIVALS = 12;
