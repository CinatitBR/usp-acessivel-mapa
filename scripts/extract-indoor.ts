/**
 * Reads a building's floor plan PDF and writes the wall lines and text labels of
 * each floor to data/indoor/<building>/, in metres on the building's own axes.
 * Run by hand when the plan changes; the PDF is not part of the repository.
 *
 *   npm run indoor:extract -- <plan.pdf> [building-folder]
 *
 * Needs `pdftocairo` and `pdftotext` (poppler-utils). How each sheet sits on the
 * building is described in data/indoor/<building>/source.json.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildingToMap, type BuildingFrame } from './lib/indoor/frame';
import { fitHelmert } from './lib/indoor/helmert';
import { parseSheetLabels } from './lib/indoor/labels';
import { parseSheetPaths, type Point } from './lib/indoor/svgPaths';
import { extractWalls } from './lib/indoor/walls';

/** `extent` limits a sheet to part of the building's box, in metres on its axes, when the page has other things inside the box (a scale bar, say). */
type Sheet = {
  page: number;
  level: number;
  name: string;
  controls: { page: Point; building: Point }[];
  extent?: [x1: number, y1: number, x2: number, y2: number];
};
type Source = BuildingFrame & { sheets: Sheet[] };

/** A sheet's control points may miss their targets by this much, in metres. */
const MAX_SHEET_RESIDUAL = 0.1;
/** The corners on the map may be this far from a true box. */
const MAX_CORNER_RESIDUAL = 0.5;
const WALL_MARGIN_METERS = 1;
const WALL_MIN_LENGTH_METERS = 1.2;
const CENTIMETERS = 100;
const MAX_BUFFER = 64 * 1024 * 1024;

const [pdf, folder = 'fau-artigas'] = process.argv.slice(2);
if (!pdf) {
  console.error('Usage: npm run indoor:extract -- <plan.pdf> [building-folder]');
  process.exit(1);
}
const directory = `data/indoor/${folder}`;
const source = JSON.parse(readFileSync(`${directory}/source.json`, 'utf8')) as Source;

const cornerResiduals = buildingToMap(source).residuals;
if (Math.max(...cornerResiduals) > MAX_CORNER_RESIDUAL) {
  throw new Error(`The corners are not a ${source.size.join(' × ')} m box: off by ${cornerResiduals.map((value) => value.toFixed(2)).join(', ')} m`);
}

const poppler = (tool: string, page: number, ...options: string[]) =>
  execFileSync(tool, [...options, '-f', String(page), '-l', String(page), pdf, '-'], { encoding: 'utf8', maxBuffer: MAX_BUFFER });

const walls: Record<string, number[]> = {};
const labels: { level: number; at: Point; lines: string[] }[] = [];
const [width, depth] = source.size;
const margin = WALL_MARGIN_METERS;

for (const sheet of source.sheets) {
  const fit = fitHelmert(sheet.controls.map(({ page, building }) => ({ from: page, to: building })));
  const worst = Math.max(...fit.residuals);
  if (worst > MAX_SHEET_RESIDUAL) throw new Error(`Sheet ${sheet.page}: a control point is ${worst.toFixed(2)} m off`);

  const [x1, y1, x2, y2] = sheet.extent ?? [-margin, -margin, width + margin, depth + margin];
  const segments = extractWalls(parseSheetPaths(poppler('pdftocairo', sheet.page, '-svg')), fit.apply, {
    extent: [x1, y1, x2, y2],
    minLength: WALL_MIN_LENGTH_METERS,
  });
  walls[sheet.level] = segments.flat().map((value) => Math.round(value * CENTIMETERS));

  let kept = 0;
  for (const label of parseSheetLabels(poppler('pdftotext', sheet.page, '-bbox-layout'))) {
    const [x, y] = fit.apply(label.center);
    if (x < x1 || x > x2 || y < y1 || y > y2) continue;
    labels.push({ level: sheet.level, at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10], lines: label.lines });
    kept++;
  }
  console.log(
    `sheet ${sheet.page} → level ${sheet.level} (${sheet.name}): 1:${(fit.scale * 72 / 0.0254).toFixed(0)}, ` +
      `turned ${fit.rotation.toFixed(2)}°, worst control ${worst.toFixed(3)} m, ${segments.length} wall lines, ${kept} labels`,
  );
}

const write = (name: string, text: string) => {
  writeFileSync(`${directory}/${name}`, text);
  console.log(`${directory}/${name}: ${(text.length / 1024).toFixed(0)} KB`);
};
// One line of text per level: the file is long but diffs stay readable.
write('walls.json', `{\n  "unit": "cm",\n  "levels": {\n${Object.entries(walls).map(([level, values]) => `    "${level}": ${JSON.stringify(values)}`).join(',\n')}\n  }\n}\n`);
write('labels.json', `[\n${labels.map((label) => `  ${JSON.stringify(label)}`).join(',\n')}\n]\n`);
