import { use, useState } from 'react';
import { loadBuildings, loadInstitutes } from '../../map/staticData';
import { type Selection, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { StepViewer } from './StepViewer';
import { useVisualRoutes } from './useVisualRoutes';

type Props = Omit<Extract<Selection, { kind: 'visualRoute' }>, 'kind'>;

/** One visual route, opened from the panel of a building or an institute: its steps from first to last, each with its photo. */
export function VisualRoutePanel({ id, unit, from }: Props) {
  const building = use(loadBuildings()).find((candidate) => from.kind === 'building' && candidate.id === from.id);
  const institute = use(loadInstitutes()).find((candidate) => from.kind === 'institute' && candidate.id === from.id);
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  // Same query as the panel it was opened from, so opening a route costs no request.
  const { data: routes, isPending } = useVisualRoutes(unit);
  const route = routes?.find((candidate) => candidate.id === id);
  /** Index of the step whose photo is open over the whole screen. */
  const [viewed, setViewed] = useState<number | null>(null);

  const back = institute
    ? {
        label: institute.sigla ?? institute.name,
        onClick: () => select({ kind: 'institute', id: institute.id, position: institute.center }),
      }
    : {
        label: building?.name ?? strings.building.unnamed,
        onClick: () => select({ kind: 'building', id: from.id }),
      };
  if (!route) {
    return (
      <BottomSheet title={strings.visualRoutes.one} onClose={clearSelection} back={back}>
        <p className="muted">{isPending ? strings.loading : strings.visualRoutes.unavailable}</p>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={route.title}
      subtitle={`${strings.visualRoutes.one} · ${strings.visualRoutes.stepCount(route.steps.length)}`}
      onClose={clearSelection}
      back={back}
    >
      <ol className="visual-steps">
        {route.steps.map((step, index) => (
          <li key={step.image}>
            <p>
              <span className="visual-step-number">{index + 1}</span>
              {step.description ?? strings.visualRoutes.step(index + 1)}
            </p>
            <button type="button" className="visual-step-photo" aria-label={strings.visualRoutes.enlarge(index + 1)} onClick={() => setViewed(index)}>
              <img src={step.image} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ol>
      {viewed !== null && <StepViewer steps={route.steps} index={viewed} onChange={setViewed} onClose={() => setViewed(null)} />}
    </BottomSheet>
  );
}
