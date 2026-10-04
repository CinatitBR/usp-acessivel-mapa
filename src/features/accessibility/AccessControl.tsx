import type { CSSProperties } from 'react';
import { ACCESS_COLORS, ACCESS_STATUSES } from '../../domain/access';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { ACCESS_KINDS } from './parse';

/** Toggle for the accessibility view, with its legend and per-kind filters while it is on. */
export function AccessControl() {
  const accessMode = useAppStore((state) => state.accessMode);
  const toggleAccessMode = useAppStore((state) => state.toggleAccessMode);
  const hidden = useAppStore((state) => state.hiddenAccessKinds);
  const toggleAccessKind = useAppStore((state) => state.toggleAccessKind);

  return (
    <div className="access-control">
      <button type="button" className="access-toggle" aria-pressed={accessMode} onClick={toggleAccessMode}>
        {strings.access.toggle}
      </button>
      {accessMode && (
        <section className="access-legend" aria-label={strings.access.legend}>
          <ul className="legend-statuses">
            {ACCESS_STATUSES.map((status) => (
              <li key={status}>
                <span
                  aria-hidden="true"
                  className={`legend-swatch legend-${status}`}
                  style={{ '--status-color': ACCESS_COLORS[status] } as CSSProperties}
                />
                {strings.access.status[status]}
              </li>
            ))}
          </ul>
          <div className="chips" role="group" aria-label={strings.access.show}>
            {ACCESS_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className="chip"
                aria-pressed={!hidden.includes(kind)}
                onClick={() => toggleAccessKind(kind)}
              >
                {strings.access.kinds[kind]}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
