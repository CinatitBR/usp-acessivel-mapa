import { ACCESS_COLORS } from '../domain/access';
import type { AccessInfo, AccessStatus } from '../domain/types';
import { formatDate, strings } from '../strings/pt-BR';

/** Shape as well as colour, so the status does not depend on colour vision. */
const SYMBOL: Record<AccessStatus, string> = { yes: '✓', partial: '◐', no: '✕', unknown: '?' };

export function StatusBadge({ status, label }: { status: AccessStatus; label?: string }) {
  return (
    <p className="access-status">
      <span aria-hidden="true" className="access-symbol" style={{ background: ACCESS_COLORS[status] }}>
        {SYMBOL[status]}
      </span>
      {label ? `${label}: ${strings.access.status[status].toLowerCase()}` : strings.access.status[status]}
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
              {strings.access.toilet}: {strings.access.status[access.toilet].toLowerCase()}
            </li>
          )}
          {access.elevator !== undefined && (
            <li>
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
