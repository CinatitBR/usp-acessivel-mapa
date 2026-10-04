import type { Badge } from '../../map/badgeIcon';

export const STOP_ICON = 'stop-bus';
export const STOP_COLOR = '#1a5fe0';

/** The front of a bus: body, windscreen, two headlights and wheels. Drawn for this project, in the style of Katu-Maps. */
const BUS_FRONT =
  'M7 2.5h10a3 3 0 0 1 3 3V17a2 2 0 0 1-1.5 1.9V20.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V19H9v1.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-1.6A2 2 0 0 1 4 17V5.5a3 3 0 0 1 3-3z' +
  ' M6.5 6v5.5h11V6z' +
  ' M6.5 15a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0z' +
  ' M14.5 15a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0z';

export const STOP_BADGE: Badge = {
  shape: 'circle',
  fill: '#ffffff',
  outline: '#b8c4d6',
  outlineWidth: 1.5,
  ink: STOP_COLOR,
  glyph: { path: BUS_FRONT },
  glyphScale: 0.62,
};
