/**
 * Makes the Katu-Maps basemap cheaper for MapLibre's workers, which run every
 * layer's filter and data expressions for every feature of every tile:
 *
 * - each group of six per-class road layers (casing, fill, bridge shadow,
 *   bridge casing, bridge fill) becomes one layer whose width is chosen per
 *   feature, since the six differed only in width;
 * - `line-sort-key` is dropped (the fills already lie above every casing);
 * - the flat building colour is a lookup instead of a per-feature colour mix.
 *
 * Pure and idempotent: a style that is already slim comes back unchanged.
 */

export type StyleLayer = {
  id: string;
  type: string;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};

/** The road groups merged into their first layer, in the order Katu-Maps draws them. */
export const ROAD_GROUPS = [
  'global-road-casing',
  'global-roads',
  'global-road-bridge-shadow',
  'global-road-bridge-casing',
  'global-road-bridges',
] as const;

const MINOR_SERVICE = ['parking_aisle', 'driveway', 'alley', 'crossover'];
const NOT_RAMP = ['!=', ['get', 'ramp'], 1];
const isMinorService = ['in', ['get', 'service'], ['literal', MINOR_SERVICE]];

/** Each tier's suffix and the filter Katu-Maps gives it, after the group's common part. */
const TIERS = {
  '': ['all', NOT_RAMP, ['==', ['get', 'class'], 'service'], isMinorService],
  '-service': ['all', NOT_RAMP, ['==', ['get', 'class'], 'service'], ['!', isMinorService]],
  '-local': ['all', NOT_RAMP, ['==', ['get', 'class'], 'minor']],
  '-ramp': ['==', ['get', 'ramp'], 1],
  '-arterial': ['all', NOT_RAMP, ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]]],
  '-major': ['all', NOT_RAMP, ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
} as const;
type Tier = keyof typeof TIERS;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A tier's width at z14; Katu-Maps doubles it every zoom from there (×4 at z16, ×16 at z18). */
function widthAt14(layer: StyleLayer): { low: unknown[]; at14: number } {
  const width = layer.paint?.['line-width'];
  const stops = Array.isArray(width) ? width.slice(3) : [];
  const at = (zoom: number) => stops[stops.indexOf(zoom) + 1];
  const at14 = at(14);
  if (
    !Array.isArray(width) ||
    !same(width.slice(0, 3), ['interpolate', ['exponential', 2], ['zoom']]) ||
    !same(stops.slice(-6), [14, at14, 16, at(16), 18, at(18)]) ||
    typeof at14 !== 'number' ||
    Math.abs((at(16) as number) - 4 * at14) > 1e-9 ||
    Math.abs((at(18) as number) - 16 * at14) > 1e-9
  ) {
    throw new Error(`${layer.id}: unexpected line-width; slimStyle needs updating`);
  }
  return { low: stops.slice(0, -6), at14 };
}

/** The width tier of a road feature, as an expression; the cases mirror `TIERS`. */
function byTier(widths: Record<Tier, number>): unknown[] {
  return [
    'case',
    ['==', ['get', 'ramp'], 1],
    widths['-ramp'],
    [
      'match',
      ['get', 'class'],
      ['motorway', 'trunk', 'primary'],
      widths['-major'],
      ['secondary', 'tertiary'],
      widths['-arterial'],
      'minor',
      widths['-local'],
      'service',
      ['match', ['get', 'service'], MINOR_SERVICE, widths[''], widths['-service']],
      widths[''],
    ],
  ];
}

function mergeRoadGroup(layers: StyleLayer[], group: string): StyleLayer[] {
  const members = new Map<Tier, StyleLayer>();
  for (const tier of Object.keys(TIERS) as Tier[]) {
    const layer = layers.find((candidate) => candidate.id === group + tier);
    if (layer) members.set(tier, layer);
  }
  if (members.size === 1 && members.has('')) return layers; // already merged
  if (members.size !== 6) throw new Error(`${group}: expected 6 per-class layers, found ${members.size}`);

  const base = members.get('')!;
  const [, common, tierFilter] = base.filter as unknown[];
  const { low } = widthAt14(base);
  const widths = {} as Record<Tier, number>;
  for (const [tier, layer] of members) {
    const { paint = {}, layout, filter } = layer;
    const { low: tierLow, at14 } = widthAt14(layer);
    const otherPaint = (p: Record<string, unknown>) => same({ ...p, 'line-width': null }, { ...base.paint, 'line-width': null });
    if (!same(filter, ['all', common, TIERS[tier]]) || !same(layout, base.layout) || !same(tierLow, low) || !otherPaint(paint)) {
      throw new Error(`${layer.id}: differs from ${group} beyond its width; slimStyle needs updating`);
    }
    widths[tier] = at14;
  }
  if (!same(tierFilter, TIERS[''])) throw new Error(`${group}: unexpected filter`);

  const tierWidth = byTier(widths);
  const merged: StyleLayer = {
    ...base,
    filter: common,
    paint: {
      ...base.paint,
      'line-width': ['interpolate', ['exponential', 2], ['zoom'], ...low, 14, tierWidth, 16, ['*', 4, tierWidth], 18, ['*', 16, tierWidth]],
    },
  };
  const dropped = new Set([...members.values()].filter((layer) => layer !== base));
  return layers.filter((layer) => !dropped.has(layer)).map((layer) => (layer === base ? merged : layer));
}

function withoutLineSortKey(layer: StyleLayer): StyleLayer {
  if (!layer.layout || !('line-sort-key' in layer.layout)) return layer;
  const { 'line-sort-key': _dropped, ...layout } = layer.layout;
  return { ...layer, layout };
}

export const FLAT_BUILDINGS = 'global-building-footprints-2d';
/**
 * Katu-Maps' building colour, without its tint from OSM `colour` tags: #fffef9 shifted by a
 * fixed offset chosen from the feature id, so neighbouring footprints read apart.
 */
const BUILDING_COLOR = [
  'match',
  ['%', ['floor', ['/', ['abs', ['to-number', ['id'], 0]], 10]], 8],
  2, '#f5f0e7',
  3, '#f1f4f5',
  4, '#f8f3e9',
  5, '#eff7ef',
  6, '#f3eff3',
  7, '#f6f1f0',
  '#fffef9',
];

function flatBuildingColor(layer: StyleLayer): StyleLayer {
  if (layer.id !== FLAT_BUILDINGS) return layer;
  return { ...layer, paint: { ...layer.paint, 'fill-color': BUILDING_COLOR } };
}

export function slimStyle<S extends { layers: StyleLayer[] }>(style: S): S {
  let layers = style.layers;
  for (const group of ROAD_GROUPS) layers = mergeRoadGroup(layers, group);
  layers = layers.map(withoutLineSortKey).map(flatBuildingColor);
  return { ...style, layers };
}
