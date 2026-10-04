import { use } from 'react';
import { loadAccessFeatures, loadBuildings } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { formatDate, strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { StatusBadge } from '../../ui/AccessSummary';

export function AccessFeaturePanel({ id }: { id: string }) {
  const feature = use(loadAccessFeatures()).find((candidate) => candidate.id === id);
  const buildings = use(loadBuildings());
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!feature) return null;

  const building = feature.buildingId ? buildings.find((candidate) => candidate.id === feature.buildingId) : undefined;
  return (
    <BottomSheet title={strings.access.kinds[feature.kind]} onClose={clearSelection}>
      <StatusBadge status={feature.status} />
      {feature.note && <p>{feature.note}</p>}
      {feature.level && (
        <p className="muted">
          {strings.access.level}: {feature.level}
        </p>
      )}
      {building && (
        <button
          type="button"
          className="link-row"
          onClick={() => select({ kind: 'building', id: building.id }, building.center)}
        >
          {strings.poi.inside} {building.name ?? strings.building.unnamed}
        </button>
      )}
      <p className="muted">
        {strings.access.source[feature.source]}
        {feature.checked && ` · ${strings.access.checked} ${formatDate(feature.checked)}`}
      </p>
    </BottomSheet>
  );
}
