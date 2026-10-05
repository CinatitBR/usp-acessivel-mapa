import type { Point } from './svgPaths';

/** A block of text on a sheet: its lines and the middle of its box, in page points. */
export type SheetLabel = { lines: string[]; center: Point };

const BLOCK = /<block xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/block>/g;
const LINE = /<line [^>]*>([\s\S]*?)<\/line>/g;
const WORD = /<word [^>]*>([^<]*)<\/word>/g;

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => ENTITIES[entity] ?? entity);

/** The text blocks of one page, read from the output of `pdftotext -bbox-layout`. */
export function parseSheetLabels(xhtml: string): SheetLabel[] {
  const labels: SheetLabel[] = [];
  for (const [, xMin, yMin, xMax, yMax, block] of xhtml.matchAll(BLOCK)) {
    const lines = [...block!.matchAll(LINE)]
      .map(([, line]) => [...line!.matchAll(WORD)].map(([, word]) => decode(word!)).join(' ').trim())
      .filter((line) => line !== '');
    if (lines.length === 0) continue;
    labels.push({ lines, center: [(Number(xMin) + Number(xMax)) / 2, (Number(yMin) + Number(yMax)) / 2] });
  }
  return labels;
}
