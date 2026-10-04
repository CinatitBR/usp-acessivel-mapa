import { use } from 'react';
import { loadAccessFeatures, loadBuildings, loadInstitutes } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { buildingKindLabel, strings } from '../../strings/pt-BR';
import { AccessSummary, StatusBadge } from '../../ui/AccessSummary';
import { BottomSheet } from '../../ui/BottomSheet';

export function BuildingPanel({ id }: { id: string }) {
  const building = use(loadBuildings()).find((candidate) => candidate.id === id);
  const institutes = use(loadInstitutes());
  const features = use(loadAccessFeatures()).filter((feature) => feature.buildingId === id);
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!building) return null;

  const institute = institutes.find((candidate) => candidate.id === building.institute);
  return (
    <BottomSheet
      title={building.name ?? strings.building.unnamed}
      subtitle={buildingKindLabel(building.kind)}
      onClose={clearSelection}
      routeTo={{ label: building.name ?? strings.building.unnamed, position: building.center }}
    >
      {institute && (
        <button
          type="button"
          className="link-row"
          onClick={() => select({ kind: 'institute', id: institute.id, position: institute.center }, institute.center)}
        >
          {institute.sigla ? `${institute.sigla} · ${institute.name}` : institute.name}
        </button>
      )}
      <AccessSummary access={building.access} />
      {features.length > 0 && (
        <div>
          <h3 className="list-title">{strings.access.features}</h3>
          <ul className="link-list">
            {features.map((feature) => (
              <li key={feature.id}>
                <button
                  type="button"
                  className="link-row"
                  onClick={() => select({ kind: 'access', id: feature.id, position: feature.position }, feature.position)}
                >
                  <StatusBadge status={feature.status} label={strings.access.kinds[feature.kind]} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
