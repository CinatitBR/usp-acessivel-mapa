import { useEffect } from 'react';
import { useOnline } from '../../lib/useOnline';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { sendReport } from './send';
import { useReports } from './useReports';

const RETRY_MS = 60_000;
/** Reports being sent right now, so two attempts never send the same one twice. */
const inFlight = new Set<string>();

/** Keeps the person's own reports up to date: sends those written without a connection, and drops those since published. Draws nothing. */
export function ReportOutbox() {
  const online = useOnline();
  const waiting = useAppStore((state) => state.myReports.filter((report) => !report.sent).length);

  useEffect(() => {
    if (!online || waiting === 0) return;
    const flush = async () => {
      const { myReports, markReportSent, removeMyReport, showToast } = useAppStore.getState();
      let sent = 0;
      for (const report of myReports) {
        if (report.sent || inFlight.has(report.id)) continue;
        inFlight.add(report.id);
        const result = await sendReport(report);
        inFlight.delete(report.id);
        if (result.status === 'sent') {
          markReportSent(report.id, result.id);
          sent++;
        } else if (result.status === 'refused') {
          // It will never be accepted; keeping it would only show a report nobody else will see.
          removeMyReport(report.id);
        } else break;
      }
      if (sent > 0) showToast({ message: strings.reports.sentLater });
    };
    void flush();
    const timer = setInterval(flush, RETRY_MS);
    return () => clearInterval(timer);
  }, [online, waiting]);

  // A report of the person's own that a reviewer has published is on the map for everyone now:
  // its hollow copy goes.
  const published = useReports();
  useEffect(() => {
    const { myReports, removeMyReport } = useAppStore.getState();
    for (const mine of myReports) {
      if (published.some((report) => report.id === mine.id)) removeMyReport(mine.id, true);
    }
  }, [published]);

  return null;
}
