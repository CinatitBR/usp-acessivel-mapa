import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';

/** Round map button that opens the route panel. */
export function RouteButton() {
  const active = useAppStore((state) => state.routePlan !== null);
  const startRoute = useAppStore((state) => state.startRoute);
  const closeRoute = useAppStore((state) => state.closeRoute);
  return (
    <button
      type="button"
      className="map-button route-open"
      aria-pressed={active}
      aria-label={strings.route.open}
      title={strings.route.open}
      onClick={() => (active ? closeRoute() : startRoute())}
    >
      <Icon name="route" />
    </button>
  );
}
