import { AccessControl } from './features/accessibility/AccessControl';
import { SearchBox } from './features/search/SearchBox';
import { CampusMap } from './map/CampusMap';
import { strings } from './strings/pt-BR';
import { LayerMenu } from './ui/LayerMenu';
import { MapStatus } from './ui/MapStatus';
import { SelectionSheet } from './ui/SelectionSheet';
import { Toast } from './ui/Toast';

export function App() {
  return (
    <main className="app">
      <div className="map-area" aria-label={strings.map.ariaLabel}>
        <CampusMap />
        <SearchBox />
        <AccessControl />
        <LayerMenu />
        <Toast />
        <MapStatus />
      </div>
      <SelectionSheet />
    </main>
  );
}
