import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { busTracker } from './busTracker';

export function BusPanel({ id }: { id: string }) {
  const clearSelection = useAppStore((state) => state.clearSelection);
  // The bus keeps moving and may leave the map, so read it again every few seconds.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 3_000);
    return () => clearInterval(timer);
  }, []);

  const bus = busTracker.get(id, now);
  if (!bus) {
    return (
      <BottomSheet title={strings.transit.bus} onClose={clearSelection}>
        <p className="muted">{strings.transit.busGone}</p>
      </BottomSheet>
    );
  }

  const seconds = Math.max(0, Math.round((now - bus.recordedAt) / 1000));
  return (
    <BottomSheet title={`${bus.lineId} · ${bus.headsign}`} subtitle={strings.transit.bus} onClose={clearSelection}>
      <p>{bus.accessible ? strings.transit.busAccessible : strings.transit.busNotAccessible}</p>
      <p className="muted">
        {strings.transit.busPrefix} {bus.id} · {strings.transit.busSeen(seconds)}
      </p>
    </BottomSheet>
  );
}
