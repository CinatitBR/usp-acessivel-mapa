import { use } from 'react';
import { loadBuildings, loadInstitutes } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { WebsiteLink } from '../../ui/WebsiteLink';
import { unitOfInstitute } from '../visualRoutes/units';
import { VisualRoutesSection } from '../visualRoutes/VisualRoutesSection';
import { WikiSection } from '../wiki/WikiSection';

export function InstitutePanel({ id }: { id: string }) {
  const institute = use(loadInstitutes()).find((candidate) => candidate.id === id);
  const buildings = use(loadBuildings());
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!institute) return null;

  const named = buildings
    .filter((building) => building.institute === id && building.name)
    .sort((a, b) => a.name!.localeCompare(b.name!, 'pt-BR', { numeric: true }));

  return (
    <BottomSheet
      title={institute.name}
      subtitle={institute.sigla}
      icon="school"
      onClose={clearSelection}
      routeTo={{ label: institute.sigla ?? institute.name, position: institute.center }}
      actions={<WebsiteLink url={institute.website} />}
    >
      <WikiSection wiki={institute.wiki} />
      <VisualRoutesSection unit={unitOfInstitute(institute.id)} from={{ kind: 'institute', id: institute.id }} />
      <h3 className="list-title">{strings.institute.buildings}</h3>
      {named.length === 0 ? (
        <p className="muted">{strings.institute.noNamedBuildings}</p>
      ) : (
        <ul className="link-list">
          {named.map((building) => (
            <li key={building.id}>
              <button
                type="button"
                className="link-row"
                onClick={() => select({ kind: 'building', id: building.id }, building.center)}
              >
                {building.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
