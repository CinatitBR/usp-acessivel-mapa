import { use } from 'react';
import { loadBuildings, loadPois } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { AccessSummary } from '../../ui/AccessSummary';
import { BottomSheet } from '../../ui/BottomSheet';

export function PoiPanel({ id }: { id: string }) {
  const poi = use(loadPois()).find((candidate) => candidate.id === id);
  const buildings = use(loadBuildings());
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!poi) return null;

  const category = strings.poi.categories[poi.category];
  const building = poi.buildingId ? buildings.find((candidate) => candidate.id === poi.buildingId) : undefined;
  return (
    <BottomSheet title={poi.name ?? category} subtitle={poi.name ? category : undefined} onClose={clearSelection}>
      {building?.name && (
        <button
          type="button"
          className="link-row"
          onClick={() => select({ kind: 'building', id: building.id }, building.center)}
        >
          {strings.poi.inside} {building.name}
        </button>
      )}
      {poi.openingHours && (
        <p className="muted">
          {strings.poi.openingHours}: {poi.openingHours}
        </p>
      )}
      <AccessSummary access={poi.access} />
    </BottomSheet>
  );
}
