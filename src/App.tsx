import { AccessControl } from './features/accessibility/AccessControl';
import { LiteToggle } from './features/litemode/LiteMode';
import { SearchBox } from './features/search/SearchBox';
import { CampusMap } from './map/CampusMap';
import { useAppStore } from './state/store';
import { strings } from './strings/pt-BR';
import { SelectionSheet } from './ui/SelectionSheet';
import { Toast } from './ui/Toast';

export function App() {
  const mapStatus = useAppStore((state) => state.mapStatus);
  const busesUnavailable = useAppStore((state) => state.busesUnavailable);

  return (
    <main className="app">
      <div className="map-area" aria-label={strings.map.ariaLabel}>
        <CampusMap />
        <SearchBox />
        <AccessControl />
        <LiteToggle />
        <Toast />
        {mapStatus !== 'ready' && (
          <p className="map-status" role="status">
            {mapStatus === 'error' ? strings.map.error : strings.map.loading}
          </p>
        )}
        {mapStatus === 'ready' && busesUnavailable && (
          <p className="map-status" role="status">
            {strings.transit.busesUnavailable}
          </p>
        )}
      </div>
      <SelectionSheet />
    </main>
  );
}
