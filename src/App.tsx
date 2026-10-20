import { AccessControl } from './features/accessibility/AccessControl';
import { ChatScreen } from './features/chat/ChatScreen';
import { LevelSwitcher } from './features/indoor/LevelSwitcher';
import { ReportOutbox } from './features/reports/Outbox';
import { ReportButton } from './features/reports/ReportButton';
import { RouteButton } from './features/routing/RouteButton';
import { SearchBox } from './features/search/SearchBox';
import { CampusMap } from './map/CampusMap';
import { useAppStore } from './state/store';
import { strings } from './strings/pt-BR';
import { BottomNav } from './ui/BottomNav';
import { LayerMenu } from './ui/LayerMenu';
import { MapStatus } from './ui/MapStatus';
import { SelectionSheet } from './ui/SelectionSheet';
import { Toast } from './ui/Toast';

export function App() {
  const screen = useAppStore((state) => state.screen);
  return (
    <main className="app">
      <div className="screens">
        {/* The map stays mounted, and keeps its size, while the chat lies over it. */}
        <div className="map-screen" data-hidden={screen !== 'map' || undefined} inert={screen !== 'map'}>
          <div className="map-area" aria-label={strings.map.ariaLabel}>
            <CampusMap />
            <SearchBox />
            <AccessControl />
            <LayerMenu />
            <RouteButton />
            <ReportButton />
            <ReportOutbox />
            <LevelSwitcher />
            <Toast />
            <MapStatus />
          </div>
          <SelectionSheet />
        </div>
        {screen === 'chat' && <ChatScreen />}
      </div>
      <BottomNav />
    </main>
  );
}
