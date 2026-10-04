import { Layer, Source } from '@vis.gl/react-maplibre';
import type { FillExtrusionLayerSpecification } from 'maplibre-gl';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';

export const BUILDINGS_SOURCE = 'buildings';
export const BUILDINGS_LAYER = 'buildings-3d';

const BUILDINGS_URL = dataUrl('buildings.geojson');
const SELECTED_COLOR = '#f59e0b';

const paint: FillExtrusionLayerSpecification['paint'] = {
  'fill-extrusion-color': [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    SELECTED_COLOR,
    [
      'match',
      ['get', 'kind'],
      'university', '#e2cfae',
      'dormitory', '#dcb99c',
      'roof', '#c8cdd0',
      ['retail', 'commercial'], '#d9c3cf',
      ['greenhouse'], '#c5dcc4',
      '#d9d0c3',
    ],
  ],
  'fill-extrusion-height': ['get', 'h'],
  'fill-extrusion-base': ['get', 'mh'],
  'fill-extrusion-opacity': 0.92,
  'fill-extrusion-vertical-gradient': true,
};

export function BuildingLayers() {
  return (
    <Source id={BUILDINGS_SOURCE} type="geojson" data={BUILDINGS_URL} promoteId="id">
      <Layer id={BUILDINGS_LAYER} type="fill-extrusion" beforeId={ANCHORS.scene3d} paint={paint} />
    </Source>
  );
}
