import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * A filter that lets each feature through from the zoom given for the value of its `property`.
 * MapLibre evaluates filters once per tile zoom, so only whole-number zooms behave as written.
 */
export function zoomTierFilter(property: string, minZooms: Readonly<Record<string, number>>): ExpressionSpecification {
  const byZoom = new Map<number, string[]>();
  for (const [value, zoom] of Object.entries(minZooms)) byZoom.set(zoom, [...(byZoom.get(zoom) ?? []), value]);
  const tiers = [...byZoom].map(
    ([zoom, values]): ExpressionSpecification => ['all', ['>=', ['zoom'], zoom], ['in', ['get', property], ['literal', values]]],
  );
  return ['any', ...tiers];
}
