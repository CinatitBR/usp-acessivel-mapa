import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { useOpenPlan } from './usePlan';

/** A true minus sign, so "−1" is as wide as "+1" would be. */
const levelLabel = (level: number) => String(level).replace('-', '−');

/** Floor buttons of the open indoor map, top floor first, with a button that puts the 3D block back. */
export function LevelSwitcher() {
  const open = useOpenPlan();
  const setIndoorLevel = useAppStore((state) => state.setIndoorLevel);
  const closeIndoor = useAppStore((state) => state.closeIndoor);
  if (!open) return null;

  const { plan, level: current } = open;
  return (
    <div className="level-switcher">
      <p className="level-name" aria-live="polite">
        <strong>{strings.indoor.level(levelLabel(current.id))}</strong>
        {current.name}
      </p>
      <div className="level-buttons" role="group" aria-label={strings.indoor.levels}>
        <button type="button" className="level-button level-close" aria-label={strings.indoor.close} title={strings.indoor.close} onClick={closeIndoor}>
          ×
        </button>
        {[...plan.levels].reverse().map((level) => (
          <button
            key={level.id}
            type="button"
            className="level-button"
            aria-pressed={level.id === current.id}
            aria-label={`${strings.indoor.level(levelLabel(level.id))}: ${level.name}`}
            title={level.name}
            onClick={() => setIndoorLevel(level.id)}
          >
            {levelLabel(level.id)}
          </button>
        ))}
      </div>
    </div>
  );
}
