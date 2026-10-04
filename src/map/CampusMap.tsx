import { AttributionControl, Map, NavigationControl } from '@vis.gl/react-maplibre';
import type { MapLibreEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  CAMPUS_CENTER,
  INITIAL_PITCH,
  INITIAL_ZOOM,
  MAP_MAX_BOUNDS,
  MAX_PITCH,
  MIN_ZOOM,
  STYLE_URL,
} from '../config';
import { AccessibilityLayers } from '../features/accessibility/layers';
import { BuildingLayers } from '../features/buildings/layers';
import { TransitLayers } from '../features/transit/layers';
import { LiveBuses } from '../features/transit/LiveBuses';
import { useAppStore } from '../state/store';
import { missingAnchors } from './anchors';
import { mapLib } from './maplibre';
import { MapSelection } from './MapSelection';
import { Scene3D } from './Scene3D';

const MAPLIBRE_ATTRIBUTION = '<a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre</a>';

/** Composition only: mounts the map and each feature's layers. */
export function CampusMap() {
  const setMapStatus = useAppStore((state) => state.setMapStatus);

  const handleLoad = (event: MapLibreEvent) => {
    const missing = missingAnchors(event.target);
    if (missing.length > 0) {
      console.error(`campus.json is missing anchor layers: ${missing.join(', ')}`);
    }
    setMapStatus('ready');
  };

  return (
    <Map
      mapLib={mapLib}
      initialViewState={{ ...CAMPUS_CENTER, zoom: INITIAL_ZOOM, pitch: INITIAL_PITCH }}
      mapStyle={STYLE_URL}
      maxBounds={MAP_MAX_BOUNDS}
      minZoom={MIN_ZOOM}
      maxPitch={MAX_PITCH}
      attributionControl={false}
      // Keeps the camera in the URL, so a view can be reloaded or shared.
      hash
      onLoad={handleLoad}
      // Style or tile failures after load are recoverable; only a failed first load is fatal.
      onError={() => {
        if (useAppStore.getState().mapStatus === 'loading') setMapStatus('error');
      }}
    >
      <AttributionControl compact customAttribution={MAPLIBRE_ATTRIBUTION} position="bottom-right" />
      <NavigationControl position="top-right" visualizePitch />
      <BuildingLayers />
      <TransitLayers />
      <LiveBuses />
      <Scene3D />
      <AccessibilityLayers />
      <MapSelection />
    </Map>
  );
}
