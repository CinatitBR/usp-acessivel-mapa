import type { Map as MaplibreMap } from 'maplibre-gl';
import { ACCESS_COLORS } from '../../domain/access';
import { isTemporary, REPORT_ANSWERS, REPORT_TYPES, type Report, reportStatus, type ReportType } from '../../domain/reports';
import { addBadgeImages, type Glyph } from '../../map/badgeIcon';
import { ACCESS_GLYPHS } from '../accessibility/icons';

const GLYPHS: Record<ReportType, Glyph> = {
  // A barrier on two legs.
  blocked: { path: 'M3 8h18v5.5H3z M6 13.5h2.2V19H6z M15.8 13.5H18V19h-2.2z' },
  step: ACCESS_GLYPHS.steps,
  // Two arrows pressing on a line.
  narrow: { path: 'M9.5 12L3 6.5v11z M14.5 12L21 6.5v11z M11 4h2v16h-2z' },
  elevator: ACCESS_GLYPHS.elevator,
  toilet: ACCESS_GLYPHS.toilet,
};

export const REPORT_ICON_PREFIX = 'report-';

/** Image name of a report's symbol. */
export const reportIconId = ({ type, answer }: Pick<Report, 'type' | 'answer'>) => `${REPORT_ICON_PREFIX}${type}-${answer}`;

/**
 * Registers the symbol of every kind of report, plus its selected form. A temporary report is
 * a triangle, the one shape the accessibility symbols do not use; a permanent one looks like
 * those symbols: a rounded square when one can get through, a diamond when not. Amber and red
 * mean the same as everywhere else. Safe to call more than once.
 */
export function addReportIcons(map: Pick<MaplibreMap, 'hasImage' | 'addImage'>) {
  for (const type of REPORT_TYPES) {
    for (const answer of REPORT_ANSWERS[type]) {
      const status = reportStatus({ answer });
      const color = ACCESS_COLORS[status];
      const shape = isTemporary({ type, answer }) ? 'triangle' : status === 'no' ? 'diamond' : 'square';
      addBadgeImages(map, reportIconId({ type, answer }), { shape, fill: color, outline: '#ffffff', outlineWidth: 1.5, ink: '#ffffff', glyph: GLYPHS[type] }, color);
    }
  }
}
