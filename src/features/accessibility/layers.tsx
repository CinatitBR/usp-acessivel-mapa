import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { ACCESS_ICON_PREFIX, addAccessIcons } from './icons';
import { ACCESS_KINDS } from './parse';

export const ACCESS_SOURCE = 'accessibility';
export const ACCESS_LAYER = 'accessibility-points';

const ACCESS_URL = dataUrl('accessibility.geojson');
const MIN_ZOOM = 15;

const layout: SymbolLayerSpecification['layout'] = {
  // Must produce the same names as accessIconId().
  'icon-image': ['concat', ACCESS_ICON_PREFIX, ['get', 'kind'], '-', ['get', 'acc']],
  'icon-size': ['interpolate', ['linear'], ['zoom'], MIN_ZOOM, 0.6, 18, 1],
  'icon-allow-overlap': true,
};

/** Points of the accessibility view. Mounted only while the view is on. */
export function AccessibilityLayers() {
  const { current: map } = useMap();
  const accessMode = useAppStore((state) => state.accessMode);
  const hidden = useAppStore((state) => state.hiddenAccessKinds);
  // Images can only be added once the style is in place. `map.isStyleLoaded()`
  // is no use here: it is also false whenever tiles are still loading.
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    if (!map || !accessMode || !mapReady) return;
    addAccessIcons(map);
    setIconsReady(true);
  }, [map, accessMode, mapReady]);

  if (!accessMode || !iconsReady) return null;

  const visible = ACCESS_KINDS.filter((kind) => !hidden.includes(kind));
  const filter: FilterSpecification = ['in', ['get', 'kind'], ['literal', visible]];
  return (
    <Source id={ACCESS_SOURCE} type="geojson" data={ACCESS_URL} promoteId="id">
      <Layer id={ACCESS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={layout} filter={filter} />
    </Source>
  );
}
