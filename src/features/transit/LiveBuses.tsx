import { Layer, Source } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import type { CircleLayerSpecification, ExpressionSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { BUS_3D_MIN_ZOOM } from '../../config';
import type { LineDirection } from '../../domain/types';
import { ANCHORS } from '../../map/anchors';
import { loadLines } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { busTracker } from './busTracker';
import { useVehicles } from './useVehicles';

/** Invisible tap targets, one per bus. This is the layer selection queries. */
export const BUSES_LAYER = 'buses-hit';
const BUSES_SOURCE = 'buses';
const REFRESH_MS = 500;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Finger-sized, and transparent through its colour rather than its opacity. */
const HIT_PAINT: CircleLayerSpecification['paint'] = { 'circle-radius': 18, 'circle-color': 'rgba(0, 0, 0, 0)' };

function busFeatures(now: number): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: busTracker.poses(now).map((pose) => ({
      type: 'Feature',
      properties: { id: pose.id, color: pose.color, line: pose.lineId.split('-')[0] },
      geometry: { type: 'Point', coordinates: pose.position },
    })),
  };
}

/**
 * Fetches live bus positions, feeds the tracker, and draws the flat markers.
 * When the 3D layer is active the markers are hidden at close zoom. A separate
 * transparent layer stays on at every zoom, because MapLibre cannot hit-test
 * Three.js models (nor layers whose opacity is 0).
 */
export function LiveBuses() {
  const [lines, setLines] = useState<LineDirection[]>([]);
  const [features, setFeatures] = useState<FeatureCollection>(EMPTY);
  const scene3dActive = useAppStore((state) => state.scene3dActive);
  const setBusesUnavailable = useAppStore((state) => state.setBusesUnavailable);

  useEffect(() => {
    loadLines().then(
      (loaded) => {
        busTracker.setLines(loaded);
        setLines(loaded);
      },
      () => setBusesUnavailable(true),
    );
  }, [setBusesUnavailable]);

  const { data, isError } = useVehicles(lines);
  useEffect(() => {
    if (data) busTracker.ingest(data, Date.now());
    if (isError) busTracker.clear();
    setBusesUnavailable(isError);
  }, [data, isError, setBusesUnavailable]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Nothing to draw and nothing drawn: skip the state update.
      setFeatures((previous) => (busTracker.count === 0 && previous.features.length === 0 ? previous : busFeatures(Date.now())));
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const opacity: ExpressionSpecification | number = scene3dActive ? ['step', ['zoom'], 1, BUS_3D_MIN_ZOOM, 0] : 1;
  const circlePaint: CircleLayerSpecification['paint'] = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 11],
    'circle-color': ['get', 'color'],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
    'circle-opacity': opacity,
    'circle-stroke-opacity': opacity,
  };
  const labelLayout: SymbolLayerSpecification['layout'] = {
    'text-field': ['get', 'line'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 10,
    'text-offset': [0, -1.6],
    'text-allow-overlap': true,
  };
  const labelPaint: SymbolLayerSpecification['paint'] = {
    'text-color': '#1f2933',
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.5,
    'text-opacity': opacity,
  };

  return (
    <Source id={BUSES_SOURCE} type="geojson" data={features}>
      <Layer id={BUSES_LAYER} type="circle" beforeId={ANCHORS.labels} paint={HIT_PAINT} />
      <Layer id="buses" type="circle" beforeId={ANCHORS.labels} paint={circlePaint} />
      <Layer id="buses-label" type="symbol" beforeId={ANCHORS.labels} minzoom={14} layout={labelLayout} paint={labelPaint} />
    </Source>
  );
}
