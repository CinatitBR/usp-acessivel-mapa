import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import type { Poi } from '../../domain/types';
import { ANCHORS } from '../../map/anchors';
import { addBadgeImages, SELECTED_SUFFIX } from '../../map/badgeIcon';
import { dataUrl, loadPois } from '../../map/staticData';
import { zoomTierFilter } from '../../map/zoomTiers';
import { useAppStore } from '../../state/store';
import { GROUP_COUNTS, groupByBuilding } from './groups';
import { POI_CATEGORIES, POI_STYLES } from './style';
import { MAP_HALO, MAP_TEXT } from '../../styles/palette';

export const POIS_LAYER = 'pois-points';
export const POIS_SELECTED_LAYER = 'pois-selected';
const POIS_SOURCE = 'pois';
const POIS_URL = dataUrl('pois.geojson');
export const POIS_GROUPS_LAYER = 'pois-groups';
const ICON_PREFIX = 'poi-';
const GROUP_ICON_PREFIX = 'poi-group-';
const GROUP_COLOR = '#8c7f6d';
const MIN_ZOOM = Math.min(...POI_CATEGORIES.map((category) => POI_STYLES[category].minZoom));
const LABEL_MIN_ZOOM = 17;
/** The places of a building are a count from this zoom, and are drawn one by one from the next. */
const GROUP_MIN_ZOOM = 17;
export const GROUP_MAX_ZOOM = 18;

/** Each category appears from its own zoom. */
const fromItsZoom = zoomTierFilter(
  'cat',
  Object.fromEntries(POI_CATEGORIES.map((category) => [category, POI_STYLES[category].minZoom])),
);

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

const groupLayout: SymbolLayerSpecification['layout'] = {
  'icon-image': ['concat', GROUP_ICON_PREFIX, ['get', 'label']],
  'icon-size': ['interpolate', ['linear'], ['zoom'], GROUP_MIN_ZOOM, 0.8, GROUP_MAX_ZOOM, 0.95],
  // A count never gives way: it stands for several places at once.
  'icon-allow-overlap': true,
};

/** A count is slightly see-through, so it sits on the roof rather than on top of the map. */
const groupPaint: SymbolLayerSpecification['paint'] = { 'icon-opacity': 0.85 };

const paint: SymbolLayerSpecification['paint'] = {
  'text-color': MAP_TEXT,
  'text-halo-color': MAP_HALO,
  'text-halo-width': 1.4,
};

/**
 * Points of interest, filtered by the categories chosen in the layer menu.
 * Hidden in the accessibility view, which has its own symbols for the same places.
 * Each category appears from its own zoom, and the places of one building are a single count
 * until the map is close. The selected one is drawn larger, with a ring, whatever is hidden.
 */
export function PoiLayers() {
  const { current: map } = useMap();
  const visible = useAppStore((state) => state.poiCategories);
  const accessMode = useAppStore((state) => state.accessMode);
  const selectedId = useAppStore((state) => (state.selection?.kind === 'poi' ? state.selection.id : ''));
  // Images can only be added once the style is in place (see AccessibilityLayers).
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);
  const [pois, setPois] = useState<Poi[]>([]);
  const groups = useMemo(() => groupByBuilding(pois, visible), [pois, visible]);

  useEffect(() => {
    // Without the list there are no counts, and every place is drawn on its own.
    loadPois().then(setPois, () => undefined);
  }, []);

  useEffect(() => {
    if (!map || !mapReady) return;
    for (const category of POI_CATEGORIES) {
      const { color, shape, glyph } = POI_STYLES[category];
      const badge = { shape, fill: color, outline: '#ffffff', outlineWidth: 1.5, ink: '#ffffff', glyph };
      addBadgeImages(map, `${ICON_PREFIX}${category}`, badge, color);
    }
    for (const count of GROUP_COUNTS) {
      const badge = { shape: 'circle' as const, fill: GROUP_COLOR, outline: '#ffffff', outlineWidth: 1.5, ink: '#ffffff', glyph: { text: count } };
      addBadgeImages(map, `${GROUP_ICON_PREFIX}${count}`, badge, GROUP_COLOR);
    }
    setIconsReady(true);
  }, [map, mapReady]);

  if (!iconsReady) return null;

  const isSelected: FilterSpecification = ['==', ['get', 'id'], selectedId];
  const alone: ExpressionSpecification = ['any', ['>=', ['zoom'], GROUP_MAX_ZOOM], ['!', ['in', ['get', 'id'], ['literal', groups.memberIds]]]];
  const filter: FilterSpecification = ['all', ['in', ['get', 'cat'], ['literal', visible]], fromItsZoom, alone, ['!', isSelected]];
  const shown = !accessMode && visible.length > 0;
  return (
    <>
      <Source id={POIS_SOURCE} type="geojson" data={POIS_URL} promoteId="id">
        {shown && (
          <Layer id={POIS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={layout} paint={paint} filter={filter} />
        )}
        <Layer id={POIS_SELECTED_LAYER} type="symbol" beforeId={ANCHORS.labels} layout={selectedLayout} paint={paint} filter={isSelected} />
      </Source>
      {shown && (
        <Source id={POIS_GROUPS_LAYER} type="geojson" data={groups.badges}>
          <Layer id={POIS_GROUPS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={GROUP_MIN_ZOOM} maxzoom={GROUP_MAX_ZOOM} layout={groupLayout} paint={groupPaint} />
        </Source>
      )}
    </>
  );
}
