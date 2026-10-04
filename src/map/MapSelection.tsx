import { Marker, useMap } from '@vis.gl/react-maplibre';
import type { MapMouseEvent } from 'maplibre-gl';
import { useEffect } from 'react';
import { ACCESS_LAYER } from '../features/accessibility/layers';
import { BUILDINGS_LAYER, BUILDINGS_SOURCE } from '../features/buildings/layers';
import { STOPS_LAYER } from '../features/transit/layers';
import { useAppStore } from '../state/store';

const FLY_MIN_ZOOM = 17;

/** Point layers that can be tapped, and the selection each one produces. */
const POINT_KINDS: Record<string, 'access' | 'stop'> = { [ACCESS_LAYER]: 'access', [STOPS_LAYER]: 'stop' };

/** Connects the map to the selection: taps select buildings and accessibility points, and the selection drives highlight, marker and camera. */
export function MapSelection() {
  const { current: map } = useMap();
  const selection = useAppStore((state) => state.selection);
  const flyTarget = useAppStore((state) => state.flyTarget);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapMouseEvent) => {
      const { select, clearSelection } = useAppStore.getState();
      // Small symbols win over the building underneath them.
      const layers = [ACCESS_LAYER, STOPS_LAYER, BUILDINGS_LAYER].filter((layer) => map.getLayer(layer));
      const feature = layers.length > 0 ? map.queryRenderedFeatures(event.point, { layers })[0] : undefined;
      const id: unknown = feature?.properties.id;
      const kind = feature && POINT_KINDS[feature.layer.id];
      if (typeof id !== 'string') clearSelection();
      else if (kind) select({ kind, id, position: event.lngLat.toArray() });
      else select({ kind: 'building', id });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  const buildingId = selection?.kind === 'building' ? selection.id : undefined;
  useEffect(() => {
    if (!map || !buildingId || !map.getSource(BUILDINGS_SOURCE)) return;
    const target = { source: BUILDINGS_SOURCE, id: buildingId };
    map.setFeatureState(target, { selected: true });
    return () => {
      // The source is gone if the style was replaced in the meantime.
      if (map.getSource(BUILDINGS_SOURCE)) map.setFeatureState(target, { selected: false });
    };
  }, [map, buildingId]);

  useEffect(() => {
    if (!map || !flyTarget) return;
    // The sheet opening has just changed the map's size; without this the target lands off-centre.
    map.resize();
    map.flyTo({ center: flyTarget.position, zoom: Math.max(map.getZoom(), FLY_MIN_ZOOM) });
  }, [map, flyTarget]);

  if (!selection || selection.kind === 'building') return null;
  return <Marker longitude={selection.position[0]} latitude={selection.position[1]} anchor="bottom" />;
}
