import { readFileSync } from 'node:fs';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { ROAD_GROUPS, slimStyle, type StyleLayer } from './slimStyle';

const style = JSON.parse(readFileSync('public/styles/campus.json', 'utf8')) as { layers: StyleLayer[] };

/** Every layer costs worker time on every tile; raise this only with a reason in docs/basemap.md. */
const LAYER_BUDGET = 70;

describe('campus.json', () => {
  it('is a valid style', () => {
    expect(validateStyleMin(style as never)).toEqual([]);
  });

  it('stays within its layer budget', () => {
    expect(style.layers.length).toBeLessThanOrEqual(LAYER_BUDGET);
  });

  it('has no per-feature line sort keys', () => {
    expect(style.layers.filter((layer) => layer.layout && 'line-sort-key' in layer.layout).map((layer) => layer.id)).toEqual([]);
  });

  it('is already slim', () => {
    expect(slimStyle(style)).toEqual(style);
    for (const group of ROAD_GROUPS) expect(style.layers.some((layer) => layer.id === group)).toBe(true);
  });
});

describe('slimStyle', () => {
  it('refuses a road group it does not recognise', () => {
    const road = style.layers.find((layer) => layer.id === 'global-roads')!;
    const extra = { ...road, id: 'global-roads-major' };
    expect(() => slimStyle({ layers: [road, extra] })).toThrow(/expected 6 per-class layers/);
  });
});
