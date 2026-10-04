/** A pictogram on a 24 × 24 grid: a filled path, a stroked path, or short text. */
export type Glyph = { path: string } | { stroke: string } | { text: string };

export type BadgeShape = 'circle' | 'square' | 'diamond';

export type Badge = {
  shape: BadgeShape;
  fill: string;
  outline: string;
  outlineWidth: number;
  /** Colour of the glyph. */
  ink: string;
  glyph: Glyph;
};

const SIZE = 28;
export const BADGE_PIXEL_RATIO = 2;

function traceShape(context: CanvasRenderingContext2D, shape: BadgeShape) {
  const center = SIZE / 2;
  const radius = SIZE / 2 - 1.5;
  context.beginPath();
  if (shape === 'square') {
    context.roundRect(center - radius, center - radius, radius * 2, radius * 2, 5);
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

/** Draws a small map icon: a coloured shape with a pictogram. Pass the result to `map.addImage`. */
export function drawBadge({ shape, fill, outline, outlineWidth, ink, glyph }: Badge): ImageData | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE * BADGE_PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.scale(BADGE_PIXEL_RATIO, BADGE_PIXEL_RATIO);

  traceShape(context, shape);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = outlineWidth;
  context.strokeStyle = outline;
  context.stroke();

  context.fillStyle = context.strokeStyle = ink;
  if ('text' in glyph) {
    context.font = `700 ${glyph.text.length > 1 ? 10 : 15}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph.text, SIZE / 2, SIZE / 2 + 0.5);
  } else {
    // The diamond has less room inside than the other shapes.
    const scale = (shape === 'diamond' ? 0.42 : 0.52) * (SIZE / 24);
    context.translate(SIZE / 2 - 12 * scale, SIZE / 2 - 12 * scale);
    context.scale(scale, scale);
    if ('stroke' in glyph) {
      context.lineWidth = 2;
      context.lineCap = context.lineJoin = 'round';
      context.stroke(new Path2D(glyph.stroke));
    } else {
      context.fill(new Path2D(glyph.path), 'evenodd');
    }
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
