import { use, useEffect, useState } from 'react';
import { Icon } from '../../ui/Icon';
import type { Arrival, BusStop } from '../../domain/types';
import { useOnline } from '../../lib/useOnline';
import { loadStops } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { busTracker } from './busTracker';
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

function ArrivalRow({ arrival, now, stopId }: { arrival: Arrival; now: number; stopId: string }) {
  const select = useAppStore((state) => state.select);
  const { primary, secondary } = arrivalLabels(arrival.time, now);
  const content = (
    <>
      <span className="arrival-line">{arrival.lineId}</span>
      <span className="arrival-head">
        {arrival.headsign}
        {arrival.accessible && <span className="arrival-tag">{strings.transit.accessibleBus}</span>}
      </span>
      <span className="arrival-time">
        <strong>{primary}</strong>
        <span>{secondary}</span>
      </span>
    </>
  );

  // Only a bus that is on the map can be followed: a live prediction of one of the tracked lines.
  const busId = arrival.source === 'live' && arrival.vehicleId && busTracker.has(arrival.vehicleId) ? arrival.vehicleId : undefined;
  if (!busId) return <li className="arrival">{content}</li>;
  return (
    <li>
      <button
        type="button"
        className="arrival arrival-follow"
        title={strings.transit.followArrival(arrival.lineId)}
        onClick={() => select({ kind: 'bus', id: busId, fromStop: stopId })}
      >
        {content}
        <span className="arrival-chevron"><Icon name="chevronRight" /></span>
      </button>
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
          <ArrivalRow key={`${arrival.lineId}-${arrival.time}-${index}`} arrival={arrival} now={now} stopId={stop.id} />
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
    <BottomSheet
      title={stop.name}
      subtitle={strings.transit.stop}
      icon="bus"
      onClose={clearSelection}
      routeTo={{ label: stop.name, position: stop.position }}
    >
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
