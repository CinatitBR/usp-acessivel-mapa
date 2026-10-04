import { Layer, Source } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import type { CircleLayerSpecification, FilterSpecification, LineLayerSpecification } from 'maplibre-gl';
import { useMemo } from 'react';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { useBusProgress } from './useBusProgress';

const LINES_URL = dataUrl('lines.geojson');
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
/** Matches no line: nothing is drawn until a bus is selected. */
const NO_LINE: FilterSpecification = ['==', ['get', 'id'], ''];
const REFRESH_MS = 1_000;

const lineLayout: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };
const casingPaint: LineLayerSpecification['paint'] = {
  'line-color': '#ffffff',
  'line-width': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 12],
  'line-opacity': 0.9,
};
const linePaint: LineLayerSpecification['paint'] = {
  'line-color': ['get', 'color'],
  'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 18, 7],
  'line-opacity': 0.9,
};

/** Passed stops are filled, stops ahead are hollow, and the user's stop is larger. */
const checkpointPaint: CircleLayerSpecification['paint'] = {
  'circle-radius': [
    'interpolate', ['linear'], ['zoom'],
    13, ['case', ['==', ['get', 'state'], 'target'], 6, 3],
    18, ['case', ['==', ['get', 'state'], 'target'], 13, 8],
  ],
  'circle-color': ['case', ['==', ['get', 'state'], 'ahead'], '#ffffff', ['get', 'color']],
  'circle-stroke-color': ['case', ['==', ['get', 'state'], 'target'], '#ffffff', ['get', 'color']],
  'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 18, 3.5],
};

/**
 * The route of the selected bus and its stops as checkpoints. No bus line is
 * drawn on the map otherwise.
 */
export function FollowedLine() {
  const selection = useAppStore((state) => state.selection);
  const bus = selection?.kind === 'bus' ? selection : undefined;
  const progress = useBusProgress(bus?.id, bus?.fromStop, REFRESH_MS);

  const line = progress?.line;
  const stops = progress?.stops;
  const passed = progress?.passed ?? 0;
  const target = progress?.target;

  const filter = useMemo<FilterSpecification>(
    () => (line ? ['all', ['==', ['get', 'id'], line.lineId], ['==', ['get', 'dir'], line.direction]] : NO_LINE),
    [line],
  );
  const checkpoints = useMemo<FeatureCollection>(() => {
    if (!line || !stops) return EMPTY;
    // The list ends at the user's stop, as the panel's does.
    const shown = target === undefined ? stops : stops.slice(0, target + 1);
    return {
      type: 'FeatureCollection',
      features: shown.map((stop, index) => ({
        type: 'Feature',
        properties: { color: line.color, state: index === target ? 'target' : index < passed ? 'passed' : 'ahead' },
        geometry: { type: 'Point', coordinates: stop.position },
      })),
    };
  }, [line, stops, passed, target]);

  return (
    <>
      <Source id="bus-lines" type="geojson" data={LINES_URL}>
        <Layer id="bus-lines-casing" type="line" beforeId={ANCHORS.features} filter={filter} layout={lineLayout} paint={casingPaint} />
        <Layer id="bus-lines" type="line" beforeId={ANCHORS.features} filter={filter} layout={lineLayout} paint={linePaint} />
      </Source>
      <Source id="bus-checkpoints" type="geojson" data={checkpoints}>
        <Layer id="bus-checkpoints" type="circle" beforeId={ANCHORS.labels} paint={checkpointPaint} />
      </Source>
    </>
  );
}
