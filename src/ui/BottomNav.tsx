import { type Screen, useAppStore } from '../state/store';
import { strings } from '../strings/pt-BR';
import { Icon, type IconName } from './Icon';

const TABS: { screen: Screen; icon: IconName; label: string }[] = [
  { screen: 'map', icon: 'map', label: strings.nav.map },
  { screen: 'chat', icon: 'chat', label: strings.nav.chat },
];

/** Switches between the map and the chat: a bar at the bottom on a phone, a rail at the side on wide screens. */
export function BottomNav() {
  const screen = useAppStore((state) => state.screen);
  const setScreen = useAppStore((state) => state.setScreen);
  return (
    <nav className="bottom-nav" aria-label={strings.nav.label}>
      {TABS.map((tab) => (
        <button
          key={tab.screen}
          type="button"
          className="bottom-nav-item"
          aria-current={screen === tab.screen ? 'page' : undefined}
          onClick={() => setScreen(tab.screen)}
        >
          <span className="bottom-nav-icon">
            <Icon name={tab.icon} />
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
