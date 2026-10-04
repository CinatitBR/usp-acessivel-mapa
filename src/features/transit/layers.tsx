import { Layer, Source } from '@vis.gl/react-maplibre';
import type { CircleLayerSpecification } from 'maplibre-gl';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';

export const STOPS_SOURCE = 'bus-stops';
export const STOPS_LAYER = 'bus-stops';

const STOPS_URL = dataUrl('stops.geojson');
const STOPS_MIN_ZOOM = 14;

const stopPaint: CircleLayerSpecification['paint'] = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 3, 18, 8],
  'circle-color': '#ffffff',
  'circle-stroke-color': '#1f2933',
  'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 1.5, 18, 3],
};

/** Every bus stop inside the campus or on a campus line. Line routes are drawn by `FollowedLine`, only for a selected bus. */
export function TransitLayers() {
  return (
    <Source id={STOPS_SOURCE} type="geojson" data={STOPS_URL} promoteId="id">
      <Layer id={STOPS_LAYER} type="circle" beforeId={ANCHORS.labels} minzoom={STOPS_MIN_ZOOM} paint={stopPaint} />
    </Source>
  );
}
