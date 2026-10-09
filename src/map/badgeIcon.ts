import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * One shape of a scene, in the badge's own box (see `boxOf`). Shapes are painted in order,
 * each filled and then outlined; `rotate` turns it, in degrees, about the middle of the badge.
 */
export type SceneLayer = { path: string; fill?: string; stroke?: string; strokeWidth?: number; rotate?: number };

/**
 * A pictogram on a 24 × 24 grid: a filled path, a stroked path, or short text. Or a scene: a
 * small drawing in its own colours that fills the badge and is cut to its shape.
 */
export type Glyph = { path: string } | { stroke: string } | { text: string } | { scene: readonly SceneLayer[] };

export type BadgeShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'pin';

export type Badge = {
  shape: BadgeShape;
  fill: string;
  outline: string;
  outlineWidth: number;
  /** Colour of the glyph. A scene has its own colours. */
  ink?: string;
  glyph: Glyph;
  /** A scene is drawn this faded. */
  glyphOpacity?: number;
  /** Size of the pictogram relative to the badge. Defaults to a size that suits the shape. */
  glyphScale?: number;
  /** The outline is drawn in dashes: not confirmed yet. */
  dashed?: boolean;
};

const SIZE = 28;
/** The selected badge: a white disc with a ring, and the normal badge in its centre. */
const SELECTED_SIZE = 42;
const RING_WIDTH = 3;
export const BADGE_PIXEL_RATIO = 2;
export const SELECTED_SUFFIX = '-selected';
/** How far below the middle of the badge the pictogram of a triangle sits. */
const TRIANGLE_DROP = 4.5;
/**
 * A pin is larger than every other badge, and taller than wide: a round head on a short tip that
 * marks the spot. The head is a circle up to `tipAngle` either side of its lowest point, which
 * leaves the pictogram as much room as the size allows.
 */
const PIN = { width: 42, height: 51, centerX: 21, centerY: 21, radius: 18, tipY: 48, tipAngle: (38 * Math.PI) / 180 };
/** The selected pin: this much larger, with a rim in the ring's colour. */
const SELECTED_PIN_SCALE = 1.3;
const PIN_RIM_WIDTH = 6;

/** The box a badge is painted in, and the middle of its pictogram. */
const boxOf = (shape: BadgeShape) =>
  shape === 'pin'
    ? { width: PIN.width, height: PIN.height, centerX: PIN.centerX, centerY: PIN.centerY }
    : { width: SIZE, height: SIZE, centerX: SIZE / 2, centerY: SIZE / 2 + (shape === 'triangle' ? TRIANGLE_DROP : 0) };

function traceShape(context: CanvasRenderingContext2D, shape: BadgeShape) {
  const center = SIZE / 2;
  const radius = SIZE / 2 - 1.5;
  context.beginPath();
  if (shape === 'pin') {
    context.lineJoin = 'round';
    // Where the head ends, and a point most of the way along its tangent there: the sides leave the circle smoothly and curve in to the tip.
    const endX = PIN.radius * Math.sin(PIN.tipAngle);
    const endY = PIN.centerY + PIN.radius * Math.cos(PIN.tipAngle);
    const controlX = endX * 0.25;
    const controlY = endY + (PIN.centerY + PIN.radius / Math.cos(PIN.tipAngle) - endY) * 0.75;
    context.moveTo(PIN.centerX, PIN.tipY);
    context.quadraticCurveTo(PIN.centerX - controlX, controlY, PIN.centerX - endX, endY);
    context.arc(PIN.centerX, PIN.centerY, PIN.radius, Math.PI / 2 + PIN.tipAngle, Math.PI * 2.5 - PIN.tipAngle);
    context.quadraticCurveTo(PIN.centerX + controlX, controlY, PIN.centerX, PIN.tipY);
    context.closePath();
  } else if (shape === 'square') {
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

/** Paints a badge in its box (see `boxOf`) at the context's origin. */
function paintBadge(context: CanvasRenderingContext2D, { shape, fill, outline, outlineWidth, ink, glyph, glyphScale, glyphOpacity, dashed }: Badge) {
  traceShape(context, shape);
  context.fillStyle = fill;
  if (shape === 'pin') {
    // A pin stands on the map: it casts a soft shadow.
    context.shadowColor = 'rgba(0, 0, 0, 0.35)';
    context.shadowBlur = 3 * BADGE_PIXEL_RATIO;
    context.shadowOffsetY = BADGE_PIXEL_RATIO;
  }
  context.fill();
  context.shadowColor = 'transparent';
  const { centerX, centerY } = boxOf(shape);
  if ('scene' in glyph) {
    // Under the outline, which then covers the edge the scene is cut at. In a pin the scene stays in the head.
    context.save();
    if (shape === 'pin') {
      context.beginPath();
      context.arc(centerX, centerY, PIN.radius - outlineWidth / 2, 0, Math.PI * 2);
    }
    context.clip();
    context.globalAlpha = glyphOpacity ?? 1;
    context.lineJoin = 'round';
    for (const layer of glyph.scene) {
      const path = new Path2D(layer.path);
      context.save();
      if (layer.rotate) {
        context.translate(centerX, centerY);
        context.rotate((layer.rotate * Math.PI) / 180);
        context.translate(-centerX, -centerY);
      }
      if (layer.fill) {
        context.fillStyle = layer.fill;
        context.fill(path);
      }
      if (layer.stroke) {
        context.strokeStyle = layer.stroke;
        context.lineWidth = layer.strokeWidth ?? 1;
        context.stroke(path);
      }
      context.restore();
    }
    context.restore();
    traceShape(context, shape);
  }
  context.lineWidth = outlineWidth;
  context.strokeStyle = outline;
  if (dashed) context.setLineDash([3.5, 2.5]);
  context.stroke();
  context.setLineDash([]);

  if ('scene' in glyph) return;
  context.fillStyle = context.strokeStyle = ink ?? outline;
  if ('text' in glyph) {
    // A triangle is widest at its foot, so its pictogram sits lower and is smaller.
    const small = shape === 'triangle';
    context.font = `700 ${small ? 8 : glyph.text.length > 1 ? 10 : 15}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph.text, centerX, small ? centerY : centerY + 0.5);
  } else {
    // The diamond has less room inside than the other shapes, the head of a pin more.
    const scale = (glyphScale ?? (shape === 'pin' ? 0.93 : shape === 'triangle' ? 0.42 : shape === 'diamond' ? 0.42 : 0.52)) * (SIZE / 24);
    context.translate(centerX - 12 * scale, centerY - 12 * scale);
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

function canvasContext(width: number, height = width): CanvasRenderingContext2D | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * BADGE_PIXEL_RATIO);
  canvas.height = Math.ceil(height * BADGE_PIXEL_RATIO);
  const context = canvas.getContext('2d');
  context?.scale(BADGE_PIXEL_RATIO, BADGE_PIXEL_RATIO);
  return context ?? undefined;
}

const imageOf = (context: CanvasRenderingContext2D) => context.getImageData(0, 0, context.canvas.width, context.canvas.height);

/** Draws a small map icon: a coloured shape with a pictogram. Pass the result to `map.addImage`. */
export function drawBadge(badge: Badge): ImageData | undefined {
  const { width, height } = boxOf(badge.shape);
  const context = canvasContext(width, height);
  if (!context) return undefined;
  paintBadge(context, badge);
  return imageOf(context);
}

/**
 * The badge of a selected symbol: larger, with a ring. The ring is always round, whatever the badge's
 * shape; only a pin keeps its shape, so that its tip stays on the spot, and gets a rim instead.
 */
export function drawSelectedBadge(badge: Badge, ringColor: string): ImageData | undefined {
  if (badge.shape === 'pin') {
    const pin = canvasContext(PIN.width * SELECTED_PIN_SCALE, PIN.height * SELECTED_PIN_SCALE);
    if (!pin) return undefined;
    pin.scale(SELECTED_PIN_SCALE, SELECTED_PIN_SCALE);
    traceShape(pin, 'pin');
    pin.lineWidth = PIN_RIM_WIDTH;
    pin.strokeStyle = ringColor;
    pin.stroke();
    paintBadge(pin, badge);
    return imageOf(pin);
  }
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
