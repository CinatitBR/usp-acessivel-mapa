import { useOnline } from '../lib/useOnline';
import { useAppStore } from '../state/store';
import { strings } from '../strings/pt-BR';

/** The one status line over the map: loading, failed, offline, or live buses unavailable. */
export function MapStatus() {
  const mapStatus = useAppStore((state) => state.mapStatus);
  const busesUnavailable = useAppStore((state) => state.busesUnavailable);
  const online = useOnline();

  // Offline comes first: with a cached map, "loading" or "check your connection" would say less.
  const message = !online
    ? strings.offline.banner
    : mapStatus === 'error'
      ? strings.map.error
      : mapStatus === 'loading'
        ? strings.map.loading
        : busesUnavailable
          ? strings.transit.busesUnavailable
          : undefined;
  if (!message) return null;
  return (
    <p className="map-status" role="status">
      {message}
    </p>
  );
}
