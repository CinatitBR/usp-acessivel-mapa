import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';

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
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M6 20V10a4 4 0 0 1 4-4h8 M15 3l3 3-3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="20" r="1.6" fill="currentColor" />
      </svg>
    </button>
  );
}
