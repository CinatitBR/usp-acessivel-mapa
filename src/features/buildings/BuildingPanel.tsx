import { use } from 'react';
import { reportStatus } from '../../domain/reports';
import { loadAccessFeatures, loadBuildings, loadInstitutes } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { buildingKindLabel, strings } from '../../strings/pt-BR';
import { AccessSummary, StatusBadge } from '../../ui/AccessSummary';
import { BottomSheet } from '../../ui/BottomSheet';
import { Icon } from '../../ui/Icon';
import { WebsiteLink } from '../../ui/WebsiteLink';
import { reportDates, reportTitle } from '../reports/ReportPanel';
import { useReports } from '../reports/useReports';
import { WikiSection } from '../wiki/WikiSection';

export function BuildingPanel({ id }: { id: string }) {
  const building = use(loadBuildings()).find((candidate) => candidate.id === id);
  const institutes = use(loadInstitutes());
  const features = use(loadAccessFeatures()).filter((feature) => feature.buildingId === id);
  const select = useAppStore((state) => state.select);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const openIndoor = useAppStore((state) => state.openIndoor);
  const indoorOpen = useAppStore((state) => state.indoor?.buildingId === id);
  // Reports about the building itself or about one of its points (an elevator, an entrance).
  const reports = useReports().filter((report) => report.target === id || features.some((feature) => feature.id === report.target));
  if (!building) return null;

  const institute = institutes.find((candidate) => candidate.id === building.institute);
  return (
    <BottomSheet
      title={building.name ?? strings.building.unnamed}
      subtitle={buildingKindLabel(building.kind)}
      icon="place"
      onClose={clearSelection}
      routeTo={{ label: building.name ?? strings.building.unnamed, position: building.center }}
      actions={
        <>
          {building.indoor && !indoorOpen && (
            <button type="button" className="button-tonal" onClick={() => openIndoor(building.id, building.indoor!)}>
              <Icon name="floor" size={20} />
              {strings.indoor.open}
            </button>
          )}
          <WebsiteLink url={building.website ?? institute?.website} />
        </>
      }
    >
      {reports.length > 0 && (
        <div>
          <h3 className="list-title">{strings.reports.inBuilding}</h3>
          <ul className="link-list">
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  className="link-row report-row"
                  onClick={() => select({ kind: 'report', id: report.id, position: report.position }, report.position)}
                >
                  <StatusBadge status={reportStatus(report)} text={reportTitle(report)} />
                  <span className="muted">{reportDates(report)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {building.address && <p className="muted">{building.address}</p>}
      {institute && (
        <button
          type="button"
          className="link-row"
          onClick={() => select({ kind: 'institute', id: institute.id, position: institute.center }, institute.center)}
        >
          {institute.sigla ? `${institute.sigla} · ${institute.name}` : institute.name}
        </button>
      )}
      {/* A building without an article of its own shows its institute's. */}
      {building.wiki ? (
        <WikiSection wiki={building.wiki} />
      ) : (
        institute?.wiki && <WikiSection wiki={institute.wiki} about={institute.sigla ?? institute.name} />
      )}
      <AccessSummary access={building.access} />
      {features.length > 0 && (
        <div>
          <h3 className="list-title">{strings.access.features}</h3>
          <ul className="link-list">
            {features.map((feature) => (
              <li key={feature.id}>
                <button
                  type="button"
                  className="link-row"
                  onClick={() => select({ kind: 'access', id: feature.id, position: feature.position }, feature.position)}
                >
                  <StatusBadge status={feature.status} label={strings.access.kinds[feature.kind]} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
