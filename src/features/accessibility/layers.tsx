import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import { ANCHORS } from '../../map/anchors';
import { SELECTED_SUFFIX } from '../../map/badgeIcon';
import { zoomTierFilter } from '../../map/zoomTiers';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { ACCESS_ICON_PREFIX, addAccessIcons } from './icons';
import { isTemporary } from '../../domain/reports';
import { useReports } from '../reports/useReports';
import type { AccessFeatureKind } from '../../domain/types';
import { ACCESS_KINDS } from './parse';

export const ACCESS_SOURCE = 'accessibility';
export const ACCESS_LAYER = 'accessibility-points';
export const ACCESS_SELECTED_LAYER = 'accessibility-selected';

const ACCESS_URL = dataUrl('accessibility.geojson');
const MIN_ZOOM = 15;
/**
 * The zoom each kind appears from. Elevators come first; steps and kerbs, most of the points,
 * come last so they do not bury the entrances and ramps.
 */
const KIND_MIN_ZOOM: Record<AccessFeatureKind, number> = {
  elevator: MIN_ZOOM,
  ramp: 16,
  entrance: 16,
  toilet: 16,
  parking: 16,
  steps: 17,
  kerb: 17,
};
const fromItsZoom = zoomTierFilter('kind', KIND_MIN_ZOOM);

const layout: SymbolLayerSpecification['layout'] = {
  // Must produce the same names as accessIconId().
  'icon-image': ['concat', ACCESS_ICON_PREFIX, ['get', 'kind'], '-', ['get', 'acc']],
  'icon-size': ['interpolate', ['linear'], ['zoom'], MIN_ZOOM, 0.6, 18, 1],
  'icon-allow-overlap': true,
  // Where symbols overlap, the higher key is drawn on top: elevators, then the rest, then steps and kerbs.
  'symbol-sort-key': ['match', ['get', 'kind'], 'elevator', 2, ['steps', 'kerb'], 0, 1],
};

const selectedLayout: SymbolLayerSpecification['layout'] = {
  'icon-image': ['concat', ACCESS_ICON_PREFIX, ['get', 'kind'], '-', ['get', 'acc'], SELECTED_SUFFIX],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};

/** Points of the accessibility view; the selected one is drawn larger, with a ring. Mounted only while the view is on. */
export function AccessibilityLayers() {
  const { current: map } = useMap();
  const accessMode = useAppStore((state) => state.accessMode);
  const hidden = useAppStore((state) => state.hiddenAccessKinds);
  const selectedId = useAppStore((state) => (state.selection?.kind === 'access' ? state.selection.id : ''));
  // Images can only be added once the style is in place. `map.isStyleLoaded()`
  // is no use here: it is also false whenever tiles are still loading.
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);
  // A point with a temporary report (an elevator out of service) is drawn as that report instead.
  const reports = useReports();
  const reported = useMemo(() => reports.filter((report) => report.target && isTemporary(report)).map((report) => report.target!), [reports]);

  useEffect(() => {
    if (!map || !accessMode || !mapReady) return;
    addAccessIcons(map);
    setIconsReady(true);
  }, [map, accessMode, mapReady]);

  if (!accessMode || !iconsReady) return null;

  const visible = ACCESS_KINDS.filter((kind) => !hidden.includes(kind));
  const isSelected: FilterSpecification = ['==', ['get', 'id'], selectedId];
  const filter: FilterSpecification = ['all', ['in', ['get', 'kind'], ['literal', visible]], fromItsZoom, ['!', isSelected], ['!', ['in', ['get', 'id'], ['literal', reported]]]];
  return (
    <Source id={ACCESS_SOURCE} type="geojson" data={ACCESS_URL} promoteId="id">
      <Layer id={ACCESS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={layout} filter={filter} />
      <Layer id={ACCESS_SELECTED_LAYER} type="symbol" beforeId={ANCHORS.labels} layout={selectedLayout} filter={isSelected} />
    </Source>
  );
}
