import { Marker, useMap } from '@vis.gl/react-maplibre';
import type { MapMouseEvent } from 'maplibre-gl';
import { useEffect } from 'react';
import { ACCESS_LAYER, ACCESS_SELECTED_LAYER } from '../features/accessibility/layers';
import { BUILDINGS_LAYER, BUILDINGS_SOURCE } from '../features/buildings/layers';
import { POIS_LAYER, POIS_SELECTED_LAYER } from '../features/pois/layers';
import { STOPS_LAYER, STOPS_SELECTED_LAYER } from '../features/transit/layers';
import { BUSES_LAYER } from '../features/transit/LiveBuses';
import { useAppStore } from '../state/store';
import { strings } from '../strings/pt-BR';

const FLY_MIN_ZOOM = 17;

/** Point layers that can be tapped, and the selection each one produces. A selected symbol lives in its own layer. */
const POINT_KINDS: Record<string, 'access' | 'stop' | 'poi'> = {
  [ACCESS_LAYER]: 'access',
  [ACCESS_SELECTED_LAYER]: 'access',
  [STOPS_LAYER]: 'stop',
  [STOPS_SELECTED_LAYER]: 'stop',
  [POIS_LAYER]: 'poi',
  [POIS_SELECTED_LAYER]: 'poi',
};

/** Connects the map to the selection: taps select buildings and point symbols, and the selection drives highlight, marker and camera. */
export function MapSelection() {
  const { current: map } = useMap();
  const selection = useAppStore((state) => state.selection);
  const flyTarget = useAppStore((state) => state.flyTarget);
  const accessMode = useAppStore((state) => state.accessMode);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapMouseEvent) => {
      const { select, clearSelection, routePlan, setRouteEnd } = useAppStore.getState();
      // Small symbols win over the building underneath them.
      const layers = [BUSES_LAYER, ...Object.keys(POINT_KINDS), BUILDINGS_LAYER].filter((layer) => map.getLayer(layer));
      const feature = layers.length > 0 ? map.queryRenderedFeatures(event.point, { layers })[0] : undefined;
      if (routePlan?.picking) {
        // While an end of the route is being chosen, a tap sets it instead of selecting.
        const name: unknown = feature?.properties.name;
        setRouteEnd(routePlan.picking, {
          label: typeof name === 'string' && name ? name : strings.route.mapPoint,
          position: event.lngLat.toArray(),
        });
        return;
      }
      const id: unknown = feature?.properties.id;
      const kind = feature && POINT_KINDS[feature.layer.id];
      if (typeof id !== 'string') clearSelection();
      else if (feature?.layer.id === BUSES_LAYER) select({ kind: 'bus', id });
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

  // Stops, POIs and accessibility points mark themselves with a larger symbol; the pin is for what has none.
  if (!selection || !('position' in selection)) return null;
  if (selection.kind === 'stop' || selection.kind === 'poi' || (selection.kind === 'access' && accessMode)) return null;
  return <Marker longitude={selection.position[0]} latitude={selection.position[1]} anchor="bottom" />;
}
