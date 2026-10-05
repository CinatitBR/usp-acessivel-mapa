import type { CSSProperties } from 'react';
import { ACCESS_COLORS } from '../domain/access';
import type { AccessInfo, AccessStatus } from '../domain/types';
import { formatDate, strings } from '../strings/pt-BR';
import { Icon } from './Icon';

/** Shape as well as colour, so the status does not depend on colour vision. */
const SYMBOL: Record<AccessStatus, string> = { yes: '✓', partial: '◐', no: '✕', unknown: '?' };

/** `text` replaces the status's own words; `label` goes before them. */
export function StatusBadge({ status, label, text }: { status: AccessStatus; label?: string; text?: string }) {
  return (
    <p className={`access-status access-${status}`} style={{ '--status-color': ACCESS_COLORS[status] } as CSSProperties}>
      <span aria-hidden="true" className="access-symbol">
        {SYMBOL[status]}
      </span>
      {text ?? (label ? `${label}: ${strings.access.status[status].toLowerCase()}` : strings.access.status[status])}
    </p>
  );
}

/** Accessibility block of a building or POI panel. */
export function AccessSummary({ access }: { access: AccessInfo }) {
  const known = access.status !== 'unknown';
  const yesNo = (value: boolean) => (value ? strings.access.yes : strings.access.no);
  return (
    <div className="access">
      <h3 className="access-title">{strings.access.title}</h3>
      <StatusBadge status={access.status} />
      {access.note && <p>{access.note}</p>}
      {(access.toilet || access.elevator !== undefined || access.parking !== undefined) && (
        <ul className="access-details">
          {access.toilet && (
            <li>
              <Icon name="toilet" size={18} />
              {strings.access.toilet}: {strings.access.status[access.toilet].toLowerCase()}
            </li>
          )}
          {access.elevator !== undefined && (
            <li>
              <Icon name="elevator" size={18} />
              {strings.access.elevator}: {yesNo(access.elevator).toLowerCase()}
            </li>
          )}
          {access.parking !== undefined && (
            <li>
              {strings.access.parking}: {access.parking}
            </li>
          )}
        </ul>
      )}
      <p className="access-note">
        {known ? strings.access.source[access.source] : strings.access.unknownHint}
        {access.checked && ` · ${strings.access.checked} ${formatDate(access.checked)}`}
      </p>
    </div>
  );
}
