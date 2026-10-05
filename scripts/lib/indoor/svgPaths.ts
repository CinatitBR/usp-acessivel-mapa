export type Point = [x: number, y: number];

/** A drawn path of a floor plan sheet, in page points with y pointing down. */
export type SheetPath = {
  /** One list of points per pen stroke. A curve contributes only its end point. */
  strokes: Point[][];
  curved: boolean;
  filled: boolean;
};

type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const PATH = /<path style="([^"]*)" d="([^"]*)"(?: transform="matrix\(([^)]*)\)")?/g;
const TOKEN = /[MLCZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g;

/** How many numbers follow each command; a curve's last pair is the point it ends on. */
const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Z: 0 };

function parseStrokes(d: string, [a, b, c, e, tx, ty]: Matrix): { strokes: Point[][]; curved: boolean } {
  const tokens = d.match(TOKEN) ?? [];
  const strokes: Point[][] = [];
  let curved = false;
  let current: Point[] = [];
  for (let index = 0; index < tokens.length; ) {
    const command = tokens[index]!;
    const arity = ARITY[command];
    if (arity === undefined) throw new Error(`Unexpected path token "${command}"`);
    if (command === 'Z') {
      if (current.length > 1) current.push(current[0]!);
    } else {
      const x = Number(tokens[index + arity - 1]);
      const y = Number(tokens[index + arity]);
      const point: Point = [a * x + c * y + tx, b * x + e * y + ty];
      if (command === 'M') {
        if (current.length > 0) strokes.push(current);
        current = [point];
      } else {
        current.push(point);
        if (command === 'C') curved = true;
      }
    }
    index += arity + 1;
  }
  if (current.length > 0) strokes.push(current);
  return { strokes, curved };
}

/**
 * The paths of one sheet, read from the SVG that `pdftocairo -svg` writes: only
 * M, L, C and Z commands, absolute, with an optional matrix on the path. Glyph
 * outlines live in `<defs>` and are skipped.
 */
export function parseSheetPaths(svg: string): SheetPath[] {
  const body = svg.slice(svg.indexOf('</defs>') + 1);
  const paths: SheetPath[] = [];
  for (const [, style, d, matrix] of body.matchAll(PATH)) {
    const numbers = matrix?.split(',').map(Number);
    if (numbers && (numbers.length !== 6 || numbers.some(Number.isNaN))) throw new Error(`Unexpected transform "${matrix}"`);
    paths.push({ ...parseStrokes(d!, (numbers as Matrix | undefined) ?? IDENTITY), filled: /(^|;)fill:rgb/.test(style!) });
  }
  return paths;
}

/** A circle drawn as one closed curved stroke: its centre and radius, or nothing if the path is something else. */
export function circleOf(path: SheetPath): { center: Point; radius: number } | undefined {
  const stroke = path.strokes[0];
  if (!path.curved || path.strokes.length !== 1 || !stroke || stroke.length < 4) return undefined;
  const xs = stroke.map(([x]) => x);
  const ys = stroke.map(([, y]) => y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const first = stroke[0]!;
  const last = stroke.at(-1)!;
  const closed = Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.01;
  if (!closed || width <= 0 || Math.abs(width - height) > 0.05 * width) return undefined;
  return { center: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2], radius: width / 2 };
}
