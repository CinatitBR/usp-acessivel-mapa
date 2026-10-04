import type { Map as MaplibreMap } from 'maplibre-gl';
import { ACCESS_COLORS, ACCESS_STATUSES, encodeAccess } from '../../domain/access';
import type { AccessFeatureKind, AccessStatus } from '../../domain/types';
import { ACCESS_KINDS } from './parse';

const SIZE = 28;
const PIXEL_RATIO = 2;

/** Pictograms on a 24 × 24 grid: an SVG path, or short text for the two with a conventional letter. */
const GLYPHS: Record<AccessFeatureKind, { path: string } | { text: string }> = {
  ramp: { path: 'M3 19h18V7z' },
  elevator: { path: 'M12 3l5 6H7z M12 21l-5-6h10z' },
  entrance: { path: 'M6 3h12v18H6z M13.4 12a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0z' },
  toilet: { text: 'WC' },
  parking: { text: 'P' },
  kerb: { path: 'M3 18v-3h10v-5h8v3h-5v5z' },
  steps: { path: 'M3 21v-4.5h4.5V12H12V7.5h4.5V3H21v18z' },
};

export const ACCESS_ICON_PREFIX = 'access-';

/** Image name used by the symbol layer; `code` is the `acc` property of the data. */
export const accessIconId = (kind: string, code: string) => `${ACCESS_ICON_PREFIX}${kind}-${code}`;

/**
 * The background shape encodes the status, so it does not rely on colour:
 * circle = accessible, rounded square = partial, diamond = not accessible,
 * hollow circle = no information.
 */
function traceShape(context: CanvasRenderingContext2D, status: AccessStatus) {
  const center = SIZE / 2;
  const radius = SIZE / 2 - 1.5;
  context.beginPath();
  if (status === 'partial') {
    context.roundRect(center - radius, center - radius, radius * 2, radius * 2, 5);
  } else if (status === 'no') {
    context.moveTo(center, center - radius - 1);
    context.lineTo(center + radius + 1, center);
    context.lineTo(center, center + radius + 1);
    context.lineTo(center - radius - 1, center);
    context.closePath();
  } else {
    context.arc(center, center, radius, 0, Math.PI * 2);
  }
}

function drawIcon(kind: AccessFeatureKind, status: AccessStatus): ImageData | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);

  const color = ACCESS_COLORS[status];
  const hollow = status === 'unknown';
  traceShape(context, status);
  context.fillStyle = hollow ? '#ffffff' : color;
  context.fill();
  context.lineWidth = hollow ? 2 : 1.5;
  context.strokeStyle = hollow ? color : '#ffffff';
  context.stroke();

  context.fillStyle = hollow ? color : '#ffffff';
  const glyph = GLYPHS[kind];
  if ('text' in glyph) {
    context.font = `700 ${glyph.text.length > 1 ? 10 : 15}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph.text, SIZE / 2, SIZE / 2 + 0.5);
  } else {
    // The diamond has less room inside than the other shapes.
    const scale = (status === 'no' ? 0.42 : 0.52) * (SIZE / 24);
    context.translate(SIZE / 2 - 12 * scale, SIZE / 2 - 12 * scale);
    context.scale(scale, scale);
    context.fill(new Path2D(glyph.path), 'evenodd');
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Registers one image per kind and status. Safe to call more than once. */
export function addAccessIcons(map: Pick<MaplibreMap, 'hasImage' | 'addImage'>) {
  for (const kind of ACCESS_KINDS) {
    for (const status of ACCESS_STATUSES) {
      const id = accessIconId(kind, encodeAccess(status));
      if (map.hasImage(id)) continue;
      const image = drawIcon(kind, status);
      if (image) map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
    }
  }
}
