import { type Selection, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { useVisualRoutes } from './useVisualRoutes';

type Origin = Extract<Selection, { kind: 'visualRoute' }>['from'];

/**
 * The visual routes of a university unit, in the panel of the unit or of one of its
 * buildings (`from`, where a route leads back to). Nothing is shown while they load, when
 * there are none or when the backend cannot be reached: the rest of the panel does not
 * depend on them.
 */
export function VisualRoutesSection({ unit, from }: { unit: string | undefined; from: Origin }) {
  const select = useAppStore((state) => state.select);
  const { data: routes } = useVisualRoutes(unit);
  if (!unit || !routes || routes.length === 0) return null;

  return (
    <div>
      <h3 className="list-title">{strings.visualRoutes.title}</h3>
      <ul className="visual-routes">
        {routes.map((route) => (
          <li key={route.id}>
            <button type="button" className="visual-route-card" onClick={() => select({ kind: 'visualRoute', id: route.id, unit, from })}>
              {/* The last photo is where the route arrives. It repeats what the title says, so it has no text of its own. */}
              <img src={route.steps[route.steps.length - 1]!.image} alt="" loading="lazy" />
              <span>
                <strong>{route.title}</strong>
                <span className="muted">{strings.visualRoutes.stepCount(route.steps.length)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
