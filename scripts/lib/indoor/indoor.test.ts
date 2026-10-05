import { describe, expect, it } from 'vitest';
import { buildingToMap } from './frame';
import { fitHelmert } from './helmert';
import { parseSheetLabels } from './labels';
import { circleOf, parseSheetPaths, type Point, type SheetPath } from './svgPaths';
import { extractWalls, redrawFlights, type Segment } from './walls';

const STROKE = 'fill:none;stroke-width:1;stroke:rgb(0%,0%,0%);';

describe('parseSheetPaths', () => {
  it('reads strokes, applies the matrix and skips glyphs in defs', () => {
    const svg =
      '<svg><defs><symbol><path style="stroke:none;" d="M 0 0 L 1 1 Z"/></symbol></defs>' +
      `<path style="${STROKE}" d="M 100 200 L 300 200 M 0 0 L 0 50 " transform="matrix(0.12,0,0,-0.12,0,842)"/>` +
      '<path style="fill-rule:nonzero;fill:rgb(0%,0%,0%);" d="M 1 1 L 2 1 L 2 2 Z M 1 1 "/></svg>';
    const [line, triangle] = parseSheetPaths(svg);
    expect(line).toEqual({ strokes: [[[12, 818], [36, 818]], [[0, 842], [0, 836]]], curved: false, filled: false });
    expect(triangle!.filled).toBe(true);
    // Z closes the stroke back to its start.
    expect(triangle!.strokes[0]).toEqual([[1, 1], [2, 1], [2, 2], [1, 1]]);
  });

  it('marks curved paths and finds circles', () => {
    const circle = `<path style="${STROKE}" d="M 2 1 C 2 1.5 1.5 2 1 2 C 0.5 2 0 1.5 0 1 C 0 0.5 0.5 0 1 0 C 1.5 0 2 0.5 2 1 "/>`;
    const arc = `<path style="${STROKE}" d="M 2 1 C 2 1.5 1.5 2 1 2 "/>`;
    const [first, second] = parseSheetPaths(`<svg></defs>${circle}${arc}</svg>`);
    expect(first!.curved).toBe(true);
    expect(circleOf(first!)).toEqual({ center: [1, 1], radius: 1 });
    expect(circleOf(second!)).toBeUndefined();
  });

  it('refuses commands it does not know', () => {
    expect(() => parseSheetPaths(`<svg></defs><path style="${STROKE}" d="M 0 0 H 5"/></svg>`)).toThrow();
  });
});

describe('fitHelmert', () => {
  it('recovers a shift, a turn and a scale', () => {
    // Quarter turn, doubled, moved by (10, 20).
    const move = ([x, y]: Point): Point => [10 - 2 * y, 20 + 2 * x];
    const fit = fitHelmert(([[0, 0], [5, 0], [5, 3]] as Point[]).map((from) => ({ from, to: move(from) })));
    expect(fit.scale).toBeCloseTo(2);
    expect(fit.rotation).toBeCloseTo(90);
    expect(Math.max(...fit.residuals)).toBeLessThan(1e-9);
    expect(fit.apply([1, 1])).toEqual([expect.closeTo(8), expect.closeTo(22)]);
  });

  it('reports what a rigid fit cannot absorb', () => {
    const fit = fitHelmert([
      { from: [0, 0], to: [0, 0] },
      { from: [10, 0], to: [10, 0] },
      { from: [10, 10], to: [10, 12] },
      { from: [0, 10], to: [0, 12] },
    ]);
    expect(Math.max(...fit.residuals)).toBeGreaterThan(0.5);
  });

  it('fits a mirrored target when asked', () => {
    const controls = ([[0, 0], [4, 0], [4, 2]] as Point[]).map((from) => ({ from, to: [from[0], -from[1]] as Point }));
    expect(Math.max(...fitHelmert(controls, true).residuals)).toBeLessThan(1e-9);
    expect(Math.max(...fitHelmert(controls).residuals)).toBeGreaterThan(0.5);
  });

  it('needs two points', () => {
    expect(() => fitHelmert([{ from: [0, 0], to: [1, 1] }])).toThrow();
  });
});

describe('buildingToMap', () => {
  it('puts the corners of the box on the given corners', () => {
    // A 110 × 66 m box turned like FAU: x towards the east-south-east, y towards the south-south-west.
    const corners: [Point, Point, Point, Point] = [[-46.730214, -23.559675], [-46.729262, -23.560139], [-46.729566, -23.560667], [-46.730519, -23.560201]];
    const { toLngLat, residuals } = buildingToMap({ size: [110, 66], corners });
    expect(Math.max(...residuals)).toBeLessThan(0.5);
    const [lng, lat] = toLngLat([110, 66]);
    expect(lng).toBeCloseTo(corners[2][0], 5);
    expect(lat).toBeCloseTo(corners[2][1], 5);
  });
});

describe('extractWalls', () => {
  const path = (strokes: Point[][], extra: Partial<SheetPath> = {}): SheetPath => ({ strokes, curved: false, filled: false, ...extra });
  const same = (point: Point) => point;
  const options = { extent: [0, 0, 50, 30] as [number, number, number, number], minLength: 1.2 };

  it('joins the pieces of one wall and drops short lines', () => {
    const walls = extractWalls(
      [path([[[1, 5], [4, 5]]]), path([[[4, 5], [9, 5]]]), path([[[20, 5], [20.6, 5]]]), path([[[3, 2], [3, 10]]])],
      same,
      options,
    );
    expect(walls).toEqual([[1, 5, 9, 5], [3, 2, 3, 10]]);
  });

  it('keeps a dashed line apart, so its dashes are dropped', () => {
    const dashes = [0, 1, 2, 3, 4].map((index) => path([[[index * 1.5, 8], [index * 1.5 + 1, 8]]]));
    expect(extractWalls(dashes, same, options)).toEqual([]);
  });

  it('drops curved, filled, skewed and outside lines', () => {
    const walls = extractWalls(
      [
        path([[[1, 1], [9, 1]]], { curved: true }),
        path([[[1, 2], [9, 2]]], { filled: true }),
        path([[[1, 3], [9, 9]]]),
        path([[[40, 4], [60, 4]]]),
        path([[[1, 20], [9, 20]]]),
      ],
      same,
      options,
    );
    expect(walls).toEqual([[1, 20, 9, 20]]);
  });

  it('treats a line drawn twice as one', () => {
    expect(extractWalls([path([[[1, 5], [9, 5]]]), path([[[9, 5.01], [2, 5.01]]])], same, options)).toHaveLength(1);
  });
});

describe('parseSheetLabels', () => {
  it('reads one label per block, with its lines and centre', () => {
    const xhtml =
      '<block xMin="10" yMin="20" xMax="30" yMax="26"><line xMin="10" yMin="20" xMax="30" yMax="22">' +
      '<word xMin="10" yMin="20" xMax="14" yMax="22">SALA</word><word xMin="15" yMin="20" xMax="20" yMax="22">A&amp;B</word></line>' +
      '<line xMin="10" yMin="24" xMax="30" yMax="26"><word xMin="10" yMin="24" xMax="30" yMax="26">A.U.=57,77m2</word></line></block>';
    expect(parseSheetLabels(xhtml)).toEqual([{ lines: ['SALA A&B', 'A.U.=57,77m2'], center: [20, 23] }]);
  });
});

describe('redrawFlights', () => {
  it('replaces the lines across a flight by evenly spaced treads and keeps the rest', () => {
    const walls: Segment[] = [
      [10, 5, 13, 5], // a tread
      [10, 5.5, 11.2, 5.5], // a tread cut short by the break line
      [10, 4, 10, 8], // the side of the stair
      [8, 5, 13, 5.0], // a wall that only crosses the flight
      [10, 9, 13, 9], // a line below it
    ];
    const redrawn = redrawFlights(walls, [{ box: [10, 4, 13, 7], treads: 4 }]);
    expect(redrawn).toEqual([
      [10, 4, 10, 8],
      [8, 5, 13, 5],
      [10, 9, 13, 9],
      [10, 4, 13, 4],
      [10, 5, 13, 5],
      [10, 6, 13, 6],
      [10, 7, 13, 7],
    ]);
    expect(redrawFlights(walls, [])).toEqual(walls);
  });
});
