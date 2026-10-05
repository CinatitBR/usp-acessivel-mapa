import type { Map as MaplibreMap } from 'maplibre-gl';
import { ACCESS_COLORS, ACCESS_STATUSES, encodeAccess } from '../../domain/access';
import type { AccessFeatureKind, AccessStatus } from '../../domain/types';
import { addBadgeImages, type Badge, type BadgeShape, type Glyph } from '../../map/badgeIcon';
import { ACCESS_KINDS } from './parse';

export const ACCESS_GLYPHS: Record<AccessFeatureKind, Glyph> = {
  ramp: { path: 'M3 19h18V7z' },
  elevator: { path: 'M12 3l5 6H7z M12 21l-5-6h10z' },
  entrance: { path: 'M6 3h12v18H6z M13.4 12a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0z' },
  toilet: { text: 'WC' },
  parking: { text: 'P' },
  kerb: { path: 'M3 18v-3h10v-5h8v3h-5v5z' },
  steps: { path: 'M3 21v-4.5h4.5V12H12V7.5h4.5V3H21v18z' },
};

/**
 * The background shape encodes the status, so it does not rely on colour:
 * circle = accessible, rounded square = partial, diamond = not accessible,
 * hollow circle = no information.
 */
const SHAPES: Record<AccessStatus, BadgeShape> = { yes: 'circle', partial: 'square', no: 'diamond', unknown: 'circle' };

export const ACCESS_ICON_PREFIX = 'access-';

/** Image name used by the symbol layer; `code` is the `acc` property of the data. */
export const accessIconId = (kind: string, code: string) => `${ACCESS_ICON_PREFIX}${kind}-${code}`;

function badgeOf(kind: AccessFeatureKind, status: AccessStatus): Badge {
  const color = ACCESS_COLORS[status];
  const hollow = status === 'unknown';
  return {
    shape: SHAPES[status],
    fill: hollow ? '#ffffff' : color,
    outline: hollow ? color : '#ffffff',
    outlineWidth: hollow ? 2 : 1.5,
    ink: hollow ? color : '#ffffff',
    glyph: ACCESS_GLYPHS[kind],
  };
}

/** Registers one image per kind and status, plus its selected form. Safe to call more than once. */
export function addAccessIcons(map: Pick<MaplibreMap, 'hasImage' | 'addImage'>) {
  for (const kind of ACCESS_KINDS) {
    for (const status of ACCESS_STATUSES) {
      addBadgeImages(map, accessIconId(kind, encodeAccess(status)), badgeOf(kind, status), ACCESS_COLORS[status]);
    }
  }
}
