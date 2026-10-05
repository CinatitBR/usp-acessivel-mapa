import type { Map as MaplibreMap } from 'maplibre-gl';

/** A pictogram on a 24 × 24 grid: a filled path, a stroked path, or short text. */
export type Glyph = { path: string } | { stroke: string } | { text: string };

export type BadgeShape = 'circle' | 'square' | 'diamond' | 'triangle';

export type Badge = {
  shape: BadgeShape;
  fill: string;
  outline: string;
  outlineWidth: number;
  /** Colour of the glyph. */
  ink: string;
  glyph: Glyph;
  /** Size of the pictogram relative to the badge. Defaults to a size that suits the shape. */
  glyphScale?: number;
};

const SIZE = 28;
/** The selected badge: a white disc with a ring, and the normal badge in its centre. */
const SELECTED_SIZE = 42;
const RING_WIDTH = 3;
export const BADGE_PIXEL_RATIO = 2;
export const SELECTED_SUFFIX = '-selected';
/** How far below the middle of the badge the pictogram of a triangle sits. */
const TRIANGLE_DROP = 4.5;

function traceShape(context: CanvasRenderingContext2D, shape: BadgeShape) {
  const center = SIZE / 2;
  const radius = SIZE / 2 - 1.5;
  context.beginPath();
  if (shape === 'square') {
    context.roundRect(center - radius, center - radius, radius * 2, radius * 2, 5);
  } else if (shape === 'triangle') {
    // A warning sign: point up, corners rounded by the line join.
    context.lineJoin = 'round';
    context.moveTo(center, 2.5);
    context.lineTo(SIZE - 1.5, SIZE - 3.5);
    context.lineTo(1.5, SIZE - 3.5);
    context.closePath();
  } else if (shape === 'diamond') {
    context.moveTo(center, center - radius - 1);
    context.lineTo(center + radius + 1, center);
    context.lineTo(center, center + radius + 1);
    context.lineTo(center - radius - 1, center);
    context.closePath();
  } else {
    context.arc(center, center, radius, 0, Math.PI * 2);
  }
}

/** Paints a badge in the SIZE × SIZE square at the context's origin. */
function paintBadge(context: CanvasRenderingContext2D, { shape, fill, outline, outlineWidth, ink, glyph, glyphScale }: Badge) {
  traceShape(context, shape);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = outlineWidth;
  context.strokeStyle = outline;
  context.stroke();

  context.fillStyle = context.strokeStyle = ink;
  if ('text' in glyph) {
    // A triangle is widest at its foot, so its pictogram sits lower and is smaller.
    const small = shape === 'triangle';
    context.font = `700 ${small ? 8 : glyph.text.length > 1 ? 10 : 15}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph.text, SIZE / 2, SIZE / 2 + (small ? TRIANGLE_DROP : 0.5));
  } else {
    // The diamond has less room inside than the other shapes.
    const scale = (glyphScale ?? (shape === 'triangle' ? 0.42 : shape === 'diamond' ? 0.42 : 0.52)) * (SIZE / 24);
    context.translate(SIZE / 2 - 12 * scale, SIZE / 2 - 12 * scale + (shape === 'triangle' ? TRIANGLE_DROP : 0));
    context.scale(scale, scale);
    if ('stroke' in glyph) {
      context.lineWidth = 2;
      context.lineCap = context.lineJoin = 'round';
      context.stroke(new Path2D(glyph.stroke));
    } else {
      context.fill(new Path2D(glyph.path), 'evenodd');
    }
  }
}

function canvasContext(size: number): CanvasRenderingContext2D | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * BADGE_PIXEL_RATIO;
  const context = canvas.getContext('2d');
  context?.scale(BADGE_PIXEL_RATIO, BADGE_PIXEL_RATIO);
  return context ?? undefined;
}

const imageOf = (context: CanvasRenderingContext2D) => context.getImageData(0, 0, context.canvas.width, context.canvas.height);

/** Draws a small map icon: a coloured shape with a pictogram. Pass the result to `map.addImage`. */
export function drawBadge(badge: Badge): ImageData | undefined {
  const context = canvasContext(SIZE);
  if (!context) return undefined;
  paintBadge(context, badge);
  return imageOf(context);
}

/** The badge of a selected symbol: larger, with a ring. The ring is always round, whatever the badge's shape. */
export function drawSelectedBadge(badge: Badge, ringColor: string): ImageData | undefined {
  const context = canvasContext(SELECTED_SIZE);
  if (!context) return undefined;
  const center = SELECTED_SIZE / 2;
  context.beginPath();
  context.arc(center, center, center - RING_WIDTH / 2 - 0.5, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.lineWidth = RING_WIDTH;
  context.strokeStyle = ringColor;
  context.stroke();

  context.translate(center - SIZE / 2, center - SIZE / 2);
  paintBadge(context, badge);
  return imageOf(context);
}

/** Registers a badge as `id` and its selected form as `id-selected`. Safe to call more than once. */
export function addBadgeImages(map: Pick<MaplibreMap, 'hasImage' | 'addImage'>, id: string, badge: Badge, ringColor: string) {
  const selectedId = `${id}${SELECTED_SUFFIX}`;
  if (!map.hasImage(id)) {
    const image = drawBadge(badge);
    if (image) map.addImage(id, image, { pixelRatio: BADGE_PIXEL_RATIO });
  }
  if (!map.hasImage(selectedId)) {
    const image = drawSelectedBadge(badge, ringColor);
    if (image) map.addImage(selectedId, image, { pixelRatio: BADGE_PIXEL_RATIO });
  }
}
