/**
 * One-off: rebuilds public/styles/campus.json from Katu-Maps' GLOBAL_MAP_STYLE
 * (MIT, © Karri Ojala). That style is built in TypeScript from helpers and
 * browser values, so it is bundled with those values stubbed, executed, and
 * the resulting plain object is pruned for a flat, street-scale campus map.
 * Nothing in Katu-Maps is modified. Hand edits to campus.json are lost when
 * this runs again.
 *
 * Usage: npx tsx scripts/export-katu-style.ts [path to Katu-Maps]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const katu = resolve(process.argv[2] ?? '../Katu-Maps');
const entry = `${katu}/apps/map-app/src/map/GlobalMapStyle.ts`;
const RAW_OUT = 'data/raw/katu-style.json';
const STYLE_OUT = 'public/styles/campus.json';

const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
  // Katu-Maps may not have its dependencies installed; fall back to this project's.
  nodePaths: [resolve('node_modules')],
  define: { 'import.meta.env': '{}' },
  banner: { js: 'const navigator = { language: "pt-BR", languages: ["pt-BR", "pt"] }; const window = undefined; const document = undefined;' },
});

const code = bundle.outputFiles[0]!.text;
const module = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as {
  GLOBAL_MAP_STYLE?: unknown;
};
if (!module.GLOBAL_MAP_STYLE) throw new Error('GLOBAL_MAP_STYLE is not exported by GlobalMapStyle.ts');

type Layer = {
  id: string;
  type: string;
  source?: string;
  'source-layer'?: string;
  maxzoom?: number;
  layout?: Record<string, unknown>;
  [key: string]: unknown;
};
type Style = { layers: Layer[]; sources: Record<string, unknown>; light?: unknown; glyphs?: string };

mkdirSync('data/raw', { recursive: true });
const rawJson = JSON.stringify(module.GLOBAL_MAP_STYLE, null, 1);
writeFileSync(RAW_OUT, rawJson);
const raw = JSON.parse(rawJson) as Style;

// --- Prune -------------------------------------------------------------------

const SOURCE = 'openfreemap';
/**
 * The style is pruned for street scale: layers that only show from this zoom out are dropped.
 * The camera does go further out, to frame a route across the city (MIN_ZOOM in src/config.ts).
 */
const APP_MIN_ZOOM = 13;
const DROPPED_SOURCE_LAYERS = new Set(['aeroway', 'aerodrome_label', 'mountain_peak']);
const DROPPED_IDS = new Set([
  // The campus buildings are extruded by the app; elsewhere flat footprints are enough.
  'global-buildings',
  'global-building-ground-storeys',
  'global-building-shadow',
  'global-building-contact-shadow',
  'global-building-footprints',
  // The app draws its own bus stops.
  'global-bus-stops',
]);
/** Hidden in Katu-Maps (a toggle there), but the only flat building layer: shown here. */
const FLAT_BUILDINGS = 'global-building-footprints-2d';

const dropReason = (layer: Layer): string | undefined => {
  if (layer.type !== 'background' && layer.source !== SOURCE) return `source ${layer.source}`;
  if (DROPPED_SOURCE_LAYERS.has(layer['source-layer'] ?? '')) return `source-layer ${layer['source-layer']}`;
  if (DROPPED_IDS.has(layer.id)) return 'replaced by the app';
  if (layer.id.includes('hiking')) return 'hiking';
  if (layer.maxzoom !== undefined && layer.maxzoom <= APP_MIN_ZOOM) return `only below zoom ${APP_MIN_ZOOM}`;
  if (layer.layout?.visibility === 'none' && layer.id !== FLAT_BUILDINGS) return 'hidden in Katu-Maps';
  return undefined;
};

/** Katu-Maps picks the label language from the browser; this map is always in Portuguese. */
const NAME = ['coalesce', ['get', 'name:pt'], ['get', 'name']];
const isLocalizedName = (value: unknown[]) =>
  value[0] === 'coalesce' && value.slice(1).every((part) => Array.isArray(part) && part[0] === 'get' && String(part[1]).startsWith('name'));
function fixNames(value: unknown): unknown {
  if (Array.isArray(value)) return isLocalizedName(value) ? NAME : value.map(fixNames);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, fixNames(inner)]));
  }
  return value;
}

const dropped = new Map<string, number>();
const kept: Layer[] = [];
for (const layer of raw.layers) {
  const reason = dropReason(layer);
  if (reason) {
    dropped.set(reason, (dropped.get(reason) ?? 0) + 1);
    continue;
  }
  const fixed = fixNames(layer) as Layer;
  if (fixed.id === FLAT_BUILDINGS) fixed.layout = { ...fixed.layout, visibility: 'visible' };
  kept.push(fixed);
}

// --- Anchors: the app inserts its layers before these (src/map/anchors.ts) ---

const anchor = (id: string): Layer => ({ id, type: 'background', layout: { visibility: 'none' } });
function insertBefore(test: (layer: Layer) => boolean, ...anchors: string[]) {
  const index = kept.findIndex(test);
  if (index < 0) throw new Error(`no layer to place ${anchors.join(', ')} before`);
  kept.splice(index, 0, ...anchors.map(anchor));
}
// Above land, water and piers; below every road.
insertBefore((layer) => layer.id.includes('road'), 'anchor-campus-areas');
// Above roads, rail, bridges and flat buildings; below every label and station dot.
insertBefore((layer) => layer.type === 'symbol' || layer.type === 'circle', 'anchor-features', 'anchor-3d');
kept.push(anchor('anchor-labels'));

const style = {
  version: 8,
  name: 'USP Butantã (Katu-Maps style on OpenFreeMap)',
  metadata: {
    note: 'Generated by scripts/export-katu-style.ts from Katu-Maps (MIT, © Karri Ojala). Keep the four anchor-* layers; app layers are inserted before them.',
  },
  center: [-46.7283, -23.5611],
  zoom: 15,
  // Also the sun of the app's 3D models, which read it at runtime.
  light: raw.light,
  glyphs: raw.glyphs,
  sources: { [SOURCE]: raw.sources[SOURCE] },
  layers: kept,
};
writeFileSync(STYLE_OUT, `${JSON.stringify(style, null, 2)}\n`);

console.log(`${RAW_OUT}: ${raw.layers.length} layers, sources ${Object.keys(raw.sources).join(', ')}`);
for (const [reason, count] of dropped) console.log(`  dropped ${String(count).padStart(2)}: ${reason}`);
console.log(`${STYLE_OUT}: ${kept.length} layers (4 anchors)`);
