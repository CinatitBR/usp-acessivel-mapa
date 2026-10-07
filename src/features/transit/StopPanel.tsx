import { use, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../ui/Icon';
import type { Arrival, BusStop } from '../../domain/types';
import { useOnline } from '../../lib/useOnline';
import { loadStops } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { busTracker } from './busTracker';
import { arrivalLabels } from './time';
import { estimateTrackedArrivals, mergeArrivals } from './trackedArrivals';
import { useArrivals } from './useArrivals';

/** Re-renders every 10 s so "3 min" keeps counting down, and estimates follow the buses, between refreshes. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
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
        <strong>{arrival.source === 'estimated' ? strings.transit.estimate(primary) : primary}</strong>
        <span>{secondary}</span>
      </span>
    </>
  );

  // Only a bus that is on the map can be followed: one of the tracked lines, predicted or estimated.
  const busId = arrival.source !== 'scheduled' && arrival.vehicleId && busTracker.has(arrival.vehicleId) ? arrival.vehicleId : undefined;
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
  const stops = use(loadStops());
  const positions = useMemo(() => new Map(stops.map((candidate) => [candidate.id, candidate.position])), [stops]);

  // Offline, the request is paused rather than failed, and old predictions would mislead.
  if (!online) return <p className="muted">{strings.offline.arrivals}</p>;
  if (isPending) return <p className="muted">{strings.loading}</p>;

  // SPTrans leaves campus buses out at some stops, so the buses on the map fill the list in.
  // Their positions are a separate request: they can be there when the predictions are not.
  const estimated = estimateTrackedArrivals(
    stop,
    busTracker.poses(now),
    (lineId, direction) => busTracker.route(lineId, direction),
    (stopId) => positions.get(stopId),
    now,
  );
  const arrivals = mergeArrivals(
    data?.arrivals ?? [],
    estimated,
    (lineId) => busTracker.route(lineId, 0) !== undefined || busTracker.route(lineId, 1) !== undefined,
  );
  if (arrivals.length === 0) {
    if (isError) return <p className="muted">{strings.transit.unavailable}</p>;
    return <p className="muted">{data.liveReachable ? strings.transit.none : strings.transit.noneNoLive}</p>;
  }

  const scheduled = arrivals.every((arrival) => arrival.source === 'scheduled');
  return (
    <>
      <p className={scheduled ? 'arrivals-source scheduled' : 'arrivals-source'}>
        {!scheduled
          ? strings.transit.live
          : data?.liveReachable
            ? strings.transit.scheduledNoBuses
            : strings.transit.scheduledNoLive}
      </p>
      <ul className="arrivals">
        {arrivals.map((arrival, index) => (
          <ArrivalRow key={`${arrival.lineId}-${arrival.time}-${index}`} arrival={arrival} now={now} stopId={stop.id} />
        ))}
      </ul>
      {arrivals.some((arrival) => arrival.source === 'estimated') && <p className="muted">{strings.transit.estimatedNote}</p>}
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
