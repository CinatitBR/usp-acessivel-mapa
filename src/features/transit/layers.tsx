import { Layer, Source } from '@vis.gl/react-maplibre';
import type { CircleLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';

export const STOPS_SOURCE = 'bus-stops';
export const STOPS_LAYER = 'bus-stops';
const LINES_SOURCE = 'bus-lines';

const LINES_URL = dataUrl('lines.geojson');
const STOPS_URL = dataUrl('stops.geojson');
const STOPS_MIN_ZOOM = 14;

const lineLayout: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };
const casingPaint: LineLayerSpecification['paint'] = {
  'line-color': '#ffffff',
  'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 9],
  'line-opacity': 0.9,
};
const linePaint: LineLayerSpecification['paint'] = {
  'line-color': ['get', 'color'],
  'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 18, 5],
  'line-opacity': 0.85,
};

const stopPaint: CircleLayerSpecification['paint'] = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 3, 18, 8],
  'circle-color': '#ffffff',
  'circle-stroke-color': '#1f2933',
  'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 1.5, 18, 3],
};

/** Routes of the campus lines and every bus stop they or other lines use inside the campus. */
export function TransitLayers() {
  return (
    <>
      <Source id={LINES_SOURCE} type="geojson" data={LINES_URL}>
        <Layer id="bus-lines-casing" type="line" beforeId={ANCHORS.features} layout={lineLayout} paint={casingPaint} />
        <Layer id="bus-lines" type="line" beforeId={ANCHORS.features} layout={lineLayout} paint={linePaint} />
      </Source>
      <Source id={STOPS_SOURCE} type="geojson" data={STOPS_URL} promoteId="id">
        <Layer id={STOPS_LAYER} type="circle" beforeId={ANCHORS.labels} minzoom={STOPS_MIN_ZOOM} paint={stopPaint} />
      </Source>
    </>
  );
}
