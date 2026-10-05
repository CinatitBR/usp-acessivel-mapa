import { use } from 'react';
import { loadBuildings, loadIndoorPlan } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { levelLabel } from './LevelSwitcher';

/** A room of the open floor plan: what it is, which floor it is on, and the way back to its building. */
export function RoomPanel({ id, buildingId }: { id: string; buildingId: string }) {
  const planName = useAppStore((state) => (state.indoor?.buildingId === buildingId ? state.indoor.plan : undefined));
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const building = use(loadBuildings()).find((candidate) => candidate.id === buildingId);
  if (!planName || !building) return null;

  const plan = use(loadIndoorPlan(planName));
  const room = plan.rooms.features.find((candidate) => candidate.properties.id === id)?.properties;
  if (!room) return null;

  const buildingName = building.name ?? strings.building.unnamed;
  const level = plan.levels.find((candidate) => candidate.id === room.level);
  return (
    <BottomSheet
      title={room.name}
      subtitle={strings.indoor.categories[room.cat]}
      icon="floor"
      onClose={clearSelection}
      routeTo={{ label: buildingName, position: building.center }}
    >
      <button type="button" className="link-row" onClick={() => select({ kind: 'building', id: buildingId })}>
        {strings.poi.inside} {buildingName}
      </button>
      {level && (
        <p className="muted">
          {strings.indoor.level(levelLabel(level.id))} · {level.name} ({level.elevations})
        </p>
      )}
      <p className="muted">{plan.credit}</p>
    </BottomSheet>
  );
}
