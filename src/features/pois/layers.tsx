import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { ANCHORS } from '../../map/anchors';
import { BADGE_PIXEL_RATIO, drawBadge } from '../../map/badgeIcon';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { POI_CATEGORIES, POI_STYLES } from './style';

export const POIS_LAYER = 'pois-points';
const POIS_SOURCE = 'pois';
const POIS_URL = dataUrl('pois.geojson');
const ICON_PREFIX = 'poi-';
const MIN_ZOOM = 15;
const LABEL_MIN_ZOOM = 17;

/** Position in the category list: lower keys are placed first, so they win when icons collide. */
const sortKey: ExpressionSpecification = ['index-of', ['get', 'cat'], ['literal', POI_CATEGORIES]];

const layout: SymbolLayerSpecification['layout'] = {
  'icon-image': ['concat', ICON_PREFIX, ['get', 'cat']],
  'icon-size': ['interpolate', ['linear'], ['zoom'], MIN_ZOOM, 0.55, 18, 0.9],
  'symbol-sort-key': sortKey,
  'text-field': ['step', ['zoom'], '', LABEL_MIN_ZOOM, ['coalesce', ['get', 'name'], '']],
  'text-font': ['Noto Sans Regular'],
  'text-size': 11,
  'text-anchor': 'top',
  'text-offset': [0, 1.1],
  'text-max-width': 8,
  // The icon stays when there is no room for its name.
  'text-optional': true,
};

const paint: SymbolLayerSpecification['paint'] = {
  'text-color': '#1f2933',
  'text-halo-color': '#ffffff',
  'text-halo-width': 1.4,
};

/**
 * Points of interest, filtered by the categories chosen in the layer menu.
 * Hidden in the accessibility view, which has its own symbols for the same places.
 */
export function PoiLayers() {
  const { current: map } = useMap();
  const visible = useAppStore((state) => state.poiCategories);
  const accessMode = useAppStore((state) => state.accessMode);
  // Images can only be added once the style is in place (see AccessibilityLayers).
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    if (!map || !mapReady) return;
    for (const category of POI_CATEGORIES) {
      const id = `${ICON_PREFIX}${category}`;
      if (map.hasImage(id)) continue;
      const { color, shape, glyph } = POI_STYLES[category];
      const image = drawBadge({ shape, fill: color, outline: '#ffffff', outlineWidth: 1.5, ink: '#ffffff', glyph });
      if (image) map.addImage(id, image, { pixelRatio: BADGE_PIXEL_RATIO });
    }
    setIconsReady(true);
  }, [map, mapReady]);

  if (!iconsReady || accessMode || visible.length === 0) return null;

  const filter: FilterSpecification = ['in', ['get', 'cat'], ['literal', visible]];
  return (
    <Source id={POIS_SOURCE} type="geojson" data={POIS_URL} promoteId="id">
      <Layer id={POIS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={layout} paint={paint} filter={filter} />
    </Source>
  );
}
