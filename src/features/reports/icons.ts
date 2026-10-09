import type { Map as MaplibreMap } from 'maplibre-gl';
import { REPORT_ANSWERS, REPORT_TYPES, type Report, reportStatus } from '../../domain/reports';
import { addBadgeImages } from '../../map/badgeIcon';
import { REPORT_SCENES } from './scenes';

export const REPORT_ICON_PREFIX = 'report-';

/** Image name of a report's symbol. */
export const reportIconId = ({ type, answer }: Pick<Report, 'type' | 'answer'>) => `${REPORT_ICON_PREFIX}${type}-${answer}`;
/** The same symbol hollow, with a dashed outline: the person's own report, not reviewed yet. */
export const PENDING_SUFFIX = '-pending';

/**
 * Brighter than the accessibility colours, with the same meaning: red when one cannot get
 * through or use it, amber when one can with help.
 */
const REPORT_COLORS: Record<ReturnType<typeof reportStatus>, string> = { partial: '#f59f00', no: '#d32f2f' };

/**
 * Registers the symbol of every kind of report, plus its selected form. A report is a pin, the
 * one shape nothing else on the map uses, and larger than every other symbol; its head shows a
 * small drawing of what was reported (see `REPORT_SCENES`). Safe to call more than once.
 */
export function addReportIcons(map: Pick<MaplibreMap, 'hasImage' | 'addImage'>) {
  for (const type of REPORT_TYPES) {
    for (const answer of REPORT_ANSWERS[type]) {
      const fill = REPORT_COLORS[reportStatus({ answer })];
      const glyph = { scene: REPORT_SCENES[type] };
      const id = reportIconId({ type, answer });
      addBadgeImages(map, id, { shape: 'pin', fill, outline: '#ffffff', outlineWidth: 2.5, glyph }, fill);
      // Hollow already means "no confirmed information" among the accessibility symbols; the drawing fades with it.
      addBadgeImages(map, `${id}${PENDING_SUFFIX}`, { shape: 'pin', fill: '#ffffff', outline: fill, outlineWidth: 2.5, glyph, glyphOpacity: 0.45, dashed: true }, fill);
    }
  }
}
