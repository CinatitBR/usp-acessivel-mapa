import { useEffect, useState } from 'react';
import type { BusStop } from '../../domain/types';
import { useOnline } from '../../lib/useOnline';
import { loadStops } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { busTracker } from './busTracker';
import { StopTimeline } from './StopTimeline';
import { useArrivals } from './useArrivals';
import { type BusProgress, useBusProgress } from './useBusProgress';

const REFRESH_MS = 3_000;

/** The timeline with the live prediction for this bus at the stop it was opened from. */
function TimelineToStop({ progress, stop, now }: { progress: BusProgress; stop: BusStop; now: number }) {
  // Same query as the stop panel, so this costs no extra request.
  const { data } = useArrivals(stop);
  const arrival = data?.arrivals.find((candidate) => candidate.source === 'live' && candidate.vehicleId === progress.pose.id);
  return <StopTimeline progress={progress} now={now} {...(arrival && { targetTime: arrival.time })} />;
}

export function BusPanel({ id, fromStop }: { id: string; fromStop?: string }) {
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const following = useAppStore((state) => state.followBus);
  const setFollowBus = useAppStore((state) => state.setFollowBus);
  const online = useOnline();
  const progress = useBusProgress(id, fromStop, REFRESH_MS);
  // The countdowns and "seen N s ago" keep moving between position updates.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // A bus that left the feed cannot be followed; the panel stays so the user can go back.
  // (No progress yet can also mean the stops are still loading, so ask the tracker itself.)
  const gone = !progress && !busTracker.has(id);
  useEffect(() => {
    if (gone) setFollowBus(false);
  }, [gone, setFollowBus]);

  const back = fromStop
    ? {
        label: strings.transit.allArrivals,
        onClick: () => {
          void loadStops().then((stops) => {
            const stop = stops.find((candidate) => candidate.id === fromStop);
            if (stop) select({ kind: 'stop', id: stop.id, position: stop.position });
            else clearSelection();
          }, clearSelection);
        },
      }
    : undefined;
  if (!progress) {
    return (
      <BottomSheet title={strings.transit.bus} onClose={clearSelection} {...(back && { back })}>
        <p className="muted">{online ? strings.transit.busGone : strings.transit.busOffline}</p>
      </BottomSheet>
    );
  }

  const { pose, stops, target } = progress;
  const targetStop = target === undefined ? undefined : stops[target];
  const seconds = Math.max(0, Math.round((now - pose.recordedAt) / 1000));
  return (
    <BottomSheet
      title={`${pose.lineId} · ${pose.headsign}`}
      subtitle={strings.transit.bus}
      icon="bus"
      onClose={clearSelection}
      {...(back && { back })}
    >
      <div className="bus-follow" aria-live="polite">
        <p className="bus-live">
          <span className="live-dot" aria-hidden="true" />
          {following ? strings.transit.following : strings.transit.followPaused}
        </p>
        {!following && (
          <button type="button" className="button-tonal" onClick={() => setFollowBus(true)}>
            {strings.transit.follow}
          </button>
        )}
      </div>
      <p className="muted">
        {pose.accessible ? strings.transit.busAccessible : strings.transit.busNotAccessible}
        <br />
        {strings.transit.busPrefix} {pose.id} · {strings.transit.busSeen(seconds)}
      </p>
      {targetStop ? <TimelineToStop progress={progress} stop={targetStop} now={now} /> : <StopTimeline progress={progress} now={now} />}
    </BottomSheet>
  );
}
