import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { CircleLayerSpecification, ExpressionSpecification, MapLibreEvent, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { BUS_3D_MIN_ZOOM } from '../../config';
import type { LineDirection } from '../../domain/types';
import { ANCHORS } from '../../map/anchors';
import { useOnline } from '../../lib/useOnline';
import { loadLines } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { busFeatures, NO_BUSES, sameBusFeatures } from './busFeatures';
import { busTracker } from './busTracker';
import { feedLost, useVehicles } from './useVehicles';
import { MAP_HALO, MAP_TEXT } from '../../styles/palette';

/** Invisible tap targets, one per bus. This is the layer selection queries. */
export const BUSES_LAYER = 'buses-hit';
const BUSES_SOURCE = 'buses';
/**
 * How often the markers are moved. Each move re-tiles the source in a worker, the same workers
 * that parse basemap tiles, so it is kept slow: a bus at 40 km/h moves a few pixels a second.
 */
const REFRESH_MS = 1_000;
/** With a bus open its ring keeps pace with the camera, which follows it every 500 ms (FollowCamera). */
const SELECTED_REFRESH_MS = 500;

/** Finger-sized, and transparent through its colour rather than its opacity. */
const HIT_PAINT: CircleLayerSpecification['paint'] = { 'circle-radius': 18, 'circle-color': 'rgba(0, 0, 0, 0)' };

/**
 * Fetches live bus positions, feeds the tracker, and draws the flat markers.
 * When the 3D layer is active the markers are hidden at close zoom. A separate
 * transparent layer stays on at every zoom, because MapLibre cannot hit-test
 * Three.js models (nor layers whose opacity is 0).
 */
export function LiveBuses() {
  const { current: map } = useMap();
  const [lines, setLines] = useState<LineDirection[]>([]);
  const [features, setFeatures] = useState(NO_BUSES);
  const scene3dActive = useAppStore((state) => state.scene3dActive);
  const setBusesUnavailable = useAppStore((state) => state.setBusesUnavailable);
  const selectedBus = useAppStore((state) => (state.selection?.kind === 'bus' ? state.selection.id : ''));

  useEffect(() => {
    loadLines().then(
      (loaded) => {
        busTracker.setLines(loaded);
        setLines(loaded);
      },
      () => setBusesUnavailable(true),
    );
  }, [setBusesUnavailable]);

  const { data, isError, dataUpdatedAt, errorUpdatedAt } = useVehicles(lines);
  // Offline, polling pauses and the last positions would stay frozen on the map.
  const online = useOnline();
  useEffect(() => {
    // A missed poll or two keeps the buses where they were last seen; only a longer gap removes them.
    const lost = feedLost({ isError, dataUpdatedAt, now: Date.now() });
    if (lost || !online) busTracker.clear();
    else if (data && !isError) busTracker.ingest(data, Date.now());
    setBusesUnavailable(lost);
    // `errorUpdatedAt` changes on every failed poll, so the gap is measured again each time.
  }, [data, isError, dataUpdatedAt, errorUpdatedAt, online, setBusesUnavailable]);

  const busOpen = selectedBus !== '';
  useEffect(() => {
    // While a finger moves the map the workers are busy with new tiles; the buses wait for it to end.
    // Camera moves made by the app (following a bus) carry no browser event and do not pause them.
    let gesture = false;
    const onMoveStart = (event: MapLibreEvent<unknown>) => {
      if ('originalEvent' in event && event.originalEvent !== undefined) gesture = true;
    };
    const onMoveEnd = () => {
      gesture = false;
    };
    map?.on('movestart', onMoveStart);
    map?.on('moveend', onMoveEnd);
    const timer = setInterval(
      () => {
        if (gesture) return;
        // Keeping the previous object tells the Source nothing changed, so no setData is sent.
        setFeatures((previous) => {
          if (busTracker.count === 0 && previous.features.length === 0) return previous;
          const next = busFeatures(busTracker.poses(Date.now()));
          return sameBusFeatures(previous, next) ? previous : next;
        });
      },
      busOpen ? SELECTED_REFRESH_MS : REFRESH_MS,
    );
    return () => {
      clearInterval(timer);
      map?.off('movestart', onMoveStart);
      map?.off('moveend', onMoveEnd);
    };
  }, [map, busOpen]);

  const opacity: ExpressionSpecification | number = scene3dActive ? ['step', ['zoom'], 1, BUS_3D_MIN_ZOOM, 0] : 1;
  const circlePaint: CircleLayerSpecification['paint'] = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 11],
    'circle-color': ['get', 'color'],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
    'circle-opacity': opacity,
    'circle-stroke-opacity': opacity,
  };
  // Shown at every zoom, so the selected bus stands out as a marker and as a 3D model.
  const ringPaint: CircleLayerSpecification['paint'] = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 22],
    'circle-color': 'rgba(0, 0, 0, 0)',
    'circle-stroke-color': ['get', 'color'],
    'circle-stroke-width': 3,
  };
  const labelLayout: SymbolLayerSpecification['layout'] = {
    'text-field': ['get', 'line'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 10,
    'text-offset': [0, -1.6],
    'text-allow-overlap': true,
  };
  const labelPaint: SymbolLayerSpecification['paint'] = {
    'text-color': MAP_TEXT,
    'text-halo-color': MAP_HALO,
    'text-halo-width': 1.5,
    'text-opacity': opacity,
  };

  return (
    <Source id={BUSES_SOURCE} type="geojson" data={features}>
      <Layer id={BUSES_LAYER} type="circle" beforeId={ANCHORS.labels} paint={HIT_PAINT} />
      <Layer id="buses-ring" type="circle" beforeId={ANCHORS.labels} filter={['==', ['get', 'id'], selectedBus]} paint={ringPaint} />
      <Layer id="buses" type="circle" beforeId={ANCHORS.labels} paint={circlePaint} />
      <Layer id="buses-label" type="symbol" beforeId={ANCHORS.labels} minzoom={14} layout={labelLayout} paint={labelPaint} />
    </Source>
  );
}
