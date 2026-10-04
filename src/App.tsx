import { AccessControl } from './features/accessibility/AccessControl';
import { SearchBox } from './features/search/SearchBox';
import { CampusMap } from './map/CampusMap';
import { useAppStore } from './state/store';
import { strings } from './strings/pt-BR';
import { SelectionSheet } from './ui/SelectionSheet';

export function App() {
  const mapStatus = useAppStore((state) => state.mapStatus);

  return (
    <main className="app">
      <div className="map-area" aria-label={strings.map.ariaLabel}>
        <CampusMap />
        <SearchBox />
        <AccessControl />
        {mapStatus !== 'ready' && (
          <p className="map-status" role="status">
            {mapStatus === 'error' ? strings.map.error : strings.map.loading}
          </p>
        )}
      </div>
      <SelectionSheet />
    </main>
  );
}
