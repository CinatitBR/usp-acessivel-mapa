import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { ANCHORS } from '../../map/anchors';
import { addBadgeImages, SELECTED_SUFFIX } from '../../map/badgeIcon';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { POI_CATEGORIES, POI_STYLES } from './style';

export const POIS_LAYER = 'pois-points';
export const POIS_SELECTED_LAYER = 'pois-selected';
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

const selectedLayout: SymbolLayerSpecification['layout'] = {
  ...layout,
  'icon-image': ['concat', ICON_PREFIX, ['get', 'cat'], SELECTED_SUFFIX],
  'icon-size': 1,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'text-field': ['coalesce', ['get', 'name'], ''],
  'text-offset': [0, 1.9],
};

const paint: SymbolLayerSpecification['paint'] = {
  'text-color': '#1f2933',
  'text-halo-color': '#ffffff',
  'text-halo-width': 1.4,
};

/**
 * Points of interest, filtered by the categories chosen in the layer menu.
 * Hidden in the accessibility view, which has its own symbols for the same places.
 * The selected one is drawn larger, with a ring, even when its category is hidden.
 */
export function PoiLayers() {
  const { current: map } = useMap();
  const visible = useAppStore((state) => state.poiCategories);
  const accessMode = useAppStore((state) => state.accessMode);
  const selectedId = useAppStore((state) => (state.selection?.kind === 'poi' ? state.selection.id : ''));
  // Images can only be added once the style is in place (see AccessibilityLayers).
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    if (!map || !mapReady) return;
    for (const category of POI_CATEGORIES) {
      const { color, shape, glyph } = POI_STYLES[category];
      const badge = { shape, fill: color, outline: '#ffffff', outlineWidth: 1.5, ink: '#ffffff', glyph };
      addBadgeImages(map, `${ICON_PREFIX}${category}`, badge, color);
    }
    setIconsReady(true);
  }, [map, mapReady]);

  if (!iconsReady) return null;

  const isSelected: FilterSpecification = ['==', ['get', 'id'], selectedId];
  const filter: FilterSpecification = ['all', ['in', ['get', 'cat'], ['literal', visible]], ['!', isSelected]];
  return (
    <Source id={POIS_SOURCE} type="geojson" data={POIS_URL} promoteId="id">
      {!accessMode && visible.length > 0 && (
        <Layer id={POIS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={layout} paint={paint} filter={filter} />
      )}
      <Layer id={POIS_SELECTED_LAYER} type="symbol" beforeId={ANCHORS.labels} layout={selectedLayout} paint={paint} filter={isSelected} />
    </Source>
  );
}
