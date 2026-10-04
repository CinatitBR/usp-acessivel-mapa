import { CampusMap } from './map/CampusMap';
import { useAppStore } from './state/store';
import { strings } from './strings/pt-BR';

export function App() {
  const mapStatus = useAppStore((state) => state.mapStatus);

  return (
    <main className="app" aria-label={strings.map.ariaLabel}>
      <CampusMap />
      {mapStatus !== 'ready' && (
        <p className="map-status" role="status">
          {mapStatus === 'error' ? strings.map.error : strings.map.loading}
        </p>
      )}
    </main>
  );
}
