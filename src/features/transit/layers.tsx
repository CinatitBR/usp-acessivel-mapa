import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { ANCHORS } from '../../map/anchors';
import { addBadgeImages, SELECTED_SUFFIX } from '../../map/badgeIcon';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { STOP_BADGE, STOP_COLOR, STOP_ICON } from './stopIcon';

export const STOPS_SOURCE = 'bus-stops';
export const STOPS_LAYER = 'bus-stops';
export const STOPS_SELECTED_LAYER = 'bus-stops-selected';

const STOPS_URL = dataUrl('stops.geojson');
const STOPS_MIN_ZOOM = 14;
const LABEL_MIN_ZOOM = 17;

const label: SymbolLayerSpecification['layout'] = {
  'text-font': ['Noto Sans Regular'],
  'text-size': 11,
  'text-anchor': 'top',
  'text-max-width': 8,
  'text-optional': true,
};

const layout: SymbolLayerSpecification['layout'] = {
  ...label,
  'icon-image': STOP_ICON,
  'icon-size': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 0.45, 18, 1],
  // A stop never gives way to another symbol.
  'icon-allow-overlap': true,
  'text-field': ['step', ['zoom'], '', LABEL_MIN_ZOOM, ['coalesce', ['get', 'name'], '']],
  'text-offset': [0, 1.2],
};

const selectedLayout: SymbolLayerSpecification['layout'] = {
  ...label,
  'icon-image': `${STOP_ICON}${SELECTED_SUFFIX}`,
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'text-field': ['coalesce', ['get', 'name'], ''],
  'text-offset': [0, 1.9],
};

const paint: SymbolLayerSpecification['paint'] = {
  'text-color': '#33506b',
  'text-halo-color': '#ffffff',
  'text-halo-width': 1.4,
};

/**
 * Every bus stop inside the campus or on a campus line; the selected one is drawn larger, with a ring.
 * Line routes are drawn by `FollowedLine`, only for a selected bus.
 */
export function TransitLayers() {
  const { current: map } = useMap();
  const selectedId = useAppStore((state) => (state.selection?.kind === 'stop' ? state.selection.id : ''));
  // Images can only be added once the style is in place (see AccessibilityLayers).
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    if (!map || !mapReady) return;
    addBadgeImages(map, STOP_ICON, STOP_BADGE, STOP_COLOR);
    setIconsReady(true);
  }, [map, mapReady]);

  if (!iconsReady) return null;

  const isSelected: FilterSpecification = ['==', ['get', 'id'], selectedId];
  return (
    <Source id={STOPS_SOURCE} type="geojson" data={STOPS_URL} promoteId="id">
      <Layer id={STOPS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={STOPS_MIN_ZOOM} layout={layout} paint={paint} filter={['!', isSelected]} />
      <Layer id={STOPS_SELECTED_LAYER} type="symbol" beforeId={ANCHORS.labels} layout={selectedLayout} paint={paint} filter={isSelected} />
    </Source>
  );
}
