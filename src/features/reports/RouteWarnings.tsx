import { reportStatus } from '../../domain/reports';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { StatusBadge } from '../../ui/AccessSummary';
import { formatDistance } from '../routing/format';
import { reportTitle } from './ReportPanel';
import { useRouteWarnings } from './useRouteWarnings';

const text = strings.reports.onRoute;

/**
 * In the route panel: the reports the route passes, in the order they are met, and those about
 * the place it leads to. Draws nothing when there are none, and never says the route is clear.
 */
export function RouteWarnings() {
  const warnings = useRouteWarnings();
  const select = useAppStore((state) => state.select);
  if (warnings.length === 0) return null;
  return (
    <div className="route-reports">
      <h3 className="list-title">{text.title(warnings.length)}</h3>
      <ul className="link-list">
        {warnings.map(({ report, along, atDestination }) => {
          const passable = report.answer === 'yes' || report.answer === 'help' || report.answer === 'no';
          return (
            <li key={report.id}>
              <button
                type="button"
                className="link-row report-row"
                onClick={() => select({ kind: 'report', id: report.id, position: report.position }, report.position)}
              >
                <StatusBadge status={reportStatus(report)} text={reportTitle(report)} />
                <span className="muted">
                  {passable && `${strings.reports.passable[report.answer as 'yes' | 'help' | 'no']} · `}
                  {atDestination ? text.atDestination : text.fromStart(formatDistance(along))}
                  {report.changed && ` · ${strings.reports.feedback.mayHaveChanged}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
