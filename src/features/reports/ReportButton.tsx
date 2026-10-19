import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';
import reportIcon from '../../assets/icons/community-report.svg';

/** Round map button that starts a report; the place is then chosen by tapping the map. On phones it sits in reach of the thumb. */
export function ReportButton() {
  const active = useAppStore((state) => state.reportDraft !== null);
  const startReport = useAppStore((state) => state.startReport);
  const closeReport = useAppStore((state) => state.closeReport);
  return (
    <button
      type="button"
      className="map-button report-open"
      aria-pressed={active}
      aria-label={strings.reports.open}
      title={strings.reports.open}
      onClick={() => (active ? closeReport() : startReport())}
    >
      <img src={reportIcon} alt="" />
    </button>
  );
}

/** "Relatar" in the row of actions of a thing's panel. */
export function ReportAction({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="button-tonal" onClick={onClick}>
      <Icon name="flag" size={20} />
      {strings.reports.action}
    </button>
  );
}
