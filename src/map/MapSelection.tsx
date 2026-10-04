import { Marker, useMap } from '@vis.gl/react-maplibre';
import type { MapMouseEvent } from 'maplibre-gl';
import { useEffect } from 'react';
import { BUILDINGS_LAYER, BUILDINGS_SOURCE } from '../features/buildings/layers';
import { useAppStore } from '../state/store';

const FLY_MIN_ZOOM = 17;

/** Connects the map to the selection: taps select buildings, and the selection drives highlight, marker and camera. */
export function MapSelection() {
  const { current: map } = useMap();
  const selection = useAppStore((state) => state.selection);
  const flyTarget = useAppStore((state) => state.flyTarget);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapMouseEvent) => {
      const { select, clearSelection } = useAppStore.getState();
      const feature = map.getLayer(BUILDINGS_LAYER)
        ? map.queryRenderedFeatures(event.point, { layers: [BUILDINGS_LAYER] })[0]
        : undefined;
      const id: unknown = feature?.properties.id;
      if (typeof id === 'string') select({ kind: 'building', id });
      else clearSelection();
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
