import type { AccessInfo, AccessStatus } from '../domain/types';
import { strings } from '../strings/pt-BR';

/** Shape as well as colour, so the status does not depend on colour vision. */
const SYMBOL: Record<AccessStatus, string> = { yes: '✓', partial: '◐', no: '✕', unknown: '?' };

export function AccessSummary({ access }: { access: AccessInfo }) {
  const known = access.status !== 'unknown';
  return (
    <div className="access">
      <h3 className="access-title">{strings.access.title}</h3>
      <p className={`access-status access-${access.status}`}>
        <span aria-hidden="true" className="access-symbol">{SYMBOL[access.status]}</span>
        {strings.access.status[access.status]}
      </p>
      <p className="access-note">{known ? strings.access.source[access.source] : strings.access.unknownHint}</p>
    </div>
  );
}
