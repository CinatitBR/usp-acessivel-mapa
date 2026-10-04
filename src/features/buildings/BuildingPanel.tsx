import { use } from 'react';
import { loadBuildings, loadInstitutes } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { buildingKindLabel, strings } from '../../strings/pt-BR';
import { AccessSummary } from '../../ui/AccessSummary';
import { BottomSheet } from '../../ui/BottomSheet';

export function BuildingPanel({ id }: { id: string }) {
  const building = use(loadBuildings()).find((candidate) => candidate.id === id);
  const institutes = use(loadInstitutes());
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!building) return null;

  const institute = institutes.find((candidate) => candidate.id === building.institute);
  return (
    <BottomSheet
      title={building.name ?? strings.building.unnamed}
      subtitle={buildingKindLabel(building.kind)}
      onClose={clearSelection}
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
    </BottomSheet>
  );
}
