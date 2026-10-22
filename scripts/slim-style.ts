/**
 * Applies the slim pass (scripts/lib/slimStyle.ts) to the committed basemap
 * style in place. export-katu-style.ts runs the same pass, so this is only
 * needed after a hand edit that brings back per-class road layers.
 *
 * Usage: npm run style:slim
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { slimStyle, type StyleLayer } from './lib/slimStyle';

const STYLE = 'public/styles/campus.json';

const style = JSON.parse(readFileSync(STYLE, 'utf8')) as { layers: StyleLayer[] };
const slim = slimStyle(style);
writeFileSync(STYLE, `${JSON.stringify(slim, null, 2)}\n`);
console.log(`${STYLE}: ${style.layers.length} → ${slim.layers.length} layers`);
