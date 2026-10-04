import { use, useEffect, useState } from 'react';
import type { Arrival, BusStop } from '../../domain/types';
import { useOnline } from '../../lib/useOnline';
import { loadStops } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { arrivalLabels } from './time';
import { useArrivals } from './useArrivals';

/** Re-renders every 20 s so "3 min" keeps counting down between refreshes. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function ArrivalRow({ arrival, now }: { arrival: Arrival; now: number }) {
  const { primary, secondary } = arrivalLabels(arrival.time, now);
  return (
    <li className="arrival">
      <span className="arrival-line">{arrival.lineId}</span>
      <span className="arrival-head">
        {arrival.headsign}
        {arrival.accessible && <span className="arrival-tag">{strings.transit.accessibleBus}</span>}
      </span>
      <span className="arrival-time">
        <strong>{primary}</strong>
        <span>{secondary}</span>
      </span>
    </li>
  );
}

function Arrivals({ stop }: { stop: BusStop }) {
  const { data, isPending, isError } = useArrivals(stop);
  const now = useNow();
  const online = useOnline();

  // Offline, the request is paused rather than failed, and old predictions would mislead.
  if (!online) return <p className="muted">{strings.offline.arrivals}</p>;
  if (isPending) return <p className="muted">{strings.loading}</p>;
  if (isError) return <p className="muted">{strings.transit.unavailable}</p>;
  if (data.arrivals.length === 0) {
    return <p className="muted">{data.liveReachable ? strings.transit.none : strings.transit.noneNoLive}</p>;
  }

  const scheduled = data.arrivals.every((arrival) => arrival.source === 'scheduled');
  return (
    <>
      <p className={scheduled ? 'arrivals-source scheduled' : 'arrivals-source'}>
        {!scheduled
          ? strings.transit.live
          : data.liveReachable
            ? strings.transit.scheduledNoBuses
            : strings.transit.scheduledNoLive}
      </p>
      <ul className="arrivals">
        {data.arrivals.map((arrival, index) => (
          <ArrivalRow key={`${arrival.lineId}-${arrival.time}-${index}`} arrival={arrival} now={now} />
        ))}
      </ul>
    </>
  );
}

export function StopPanel({ id }: { id: string }) {
  const stop = use(loadStops()).find((candidate) => candidate.id === id);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!stop) return null;

  return (
    <BottomSheet title={stop.name} subtitle={strings.transit.stop} onClose={clearSelection}>
      {stop.description && <p className="muted">{stop.description}</p>}
      <div aria-live="polite">
        <h3 className="list-title">{strings.transit.arrivals}</h3>
        <Arrivals stop={stop} />
      </div>
      <p className="muted">
        {strings.transit.lines}: {stop.lineIds.join(', ')}
      </p>
    </BottomSheet>
  );
}
