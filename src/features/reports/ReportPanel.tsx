import { use } from 'react';
import { lastDay, type Report, reportStatus } from '../../domain/reports';
import { loadAccessFeatures, loadBuildings } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { formatDate, strings } from '../../strings/pt-BR';
import { StatusBadge } from '../../ui/AccessSummary';
import { BottomSheet } from '../../ui/BottomSheet';
import { useReports } from './useReports';

/** "Passagem bloqueada", "Elevador fora de serviço"… */
export const reportTitle = ({ type, answer }: Pick<Report, 'type' | 'answer'>) =>
  type === 'elevator' || type === 'toilet' ? strings.reports.states[answer as 'broken' | 'closed' | 'missing'][type] : strings.reports.types[type];

/** "Relatado em 03/10/2026 · vale até 17/10/2026" */
export function reportDates(report: Report): string {
  const last = lastDay(report);
  return `${strings.reports.since} ${formatDate(report.since)}${last ? ` · ${strings.reports.until} ${formatDate(last)}` : ''}`;
}

export function ReportPanel({ id }: { id: string }) {
  const report = useReports().find((candidate) => candidate.id === id);
  const buildings = use(loadBuildings());
  const features = use(loadAccessFeatures());
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  // The report expired, or was withdrawn, while its panel was open.
  if (!report) return <BottomSheet title={strings.reports.gone} onClose={clearSelection} />;

  // A report about an elevator or a ramp belongs to that point's building.
  const buildingId = features.find((feature) => feature.id === report.target)?.buildingId ?? report.target;
  const building = buildings.find((candidate) => candidate.id === buildingId);
  const passable = report.answer === 'yes' || report.answer === 'help' || report.answer === 'no';
  return (
    <BottomSheet title={reportTitle(report)} subtitle={strings.reports.subtitle} icon="info" onClose={clearSelection}>
      {passable && (
        <div className="access">
          <StatusBadge status={reportStatus(report)} text={strings.reports.passable[report.answer as 'yes' | 'help' | 'no']} />
        </div>
      )}
      {report.note && <p>{report.note}</p>}
      {building && (
        <button type="button" className="link-row" onClick={() => select({ kind: 'building', id: building.id }, building.center)}>
          {strings.poi.inside} {building.name ?? strings.building.unnamed}
        </button>
      )}
      <p className="muted">{reportDates(report)}</p>
    </BottomSheet>
  );
}
