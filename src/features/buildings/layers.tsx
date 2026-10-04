import { Layer, Source } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FillExtrusionLayerSpecification } from 'maplibre-gl';
import { useMemo } from 'react';
import { ACCESS_COLORS } from '../../domain/access';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { SELECTED_COLOR, UNKNOWN_ACCESS_COLOR } from './colors';

export const BUILDINGS_SOURCE = 'buildings';
export const BUILDINGS_LAYER = 'buildings-3d';

const BUILDINGS_URL = dataUrl('buildings.geojson');

const COLOR_BY_KIND: ExpressionSpecification = [
  'match',
  ['get', 'kind'],
  'university', '#e2cfae',
  'dormitory', '#dcb99c',
  'roof', '#c8cdd0',
  ['retail', 'commercial'], '#d9c3cf',
  ['greenhouse'], '#c5dcc4',
  '#d9d0c3',
];

const COLOR_BY_ACCESS: ExpressionSpecification = [
  'match',
  ['get', 'acc'],
  'y', ACCESS_COLORS.yes,
  'p', ACCESS_COLORS.partial,
  'n', ACCESS_COLORS.no,
  UNKNOWN_ACCESS_COLOR,
];

/** With the 3D scene on, a building with a shaped roof is extruded only up to its eave; the roof is a mesh on top. */
const HEIGHT_UNDER_ROOF: ExpressionSpecification = ['coalesce', ['get', 'eh'], ['get', 'h']];

const paintFor = (color: ExpressionSpecification, roofs: boolean): FillExtrusionLayerSpecification['paint'] => ({
  'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'selected'], false], SELECTED_COLOR, color],
  'fill-extrusion-height': roofs ? HEIGHT_UNDER_ROOF : ['get', 'h'],
  'fill-extrusion-base': ['get', 'mh'],
  'fill-extrusion-opacity': 0.92,
  'fill-extrusion-vertical-gradient': true,
});

export function BuildingLayers() {
  const accessMode = useAppStore((state) => state.accessMode);
  const roofs = useAppStore((state) => state.roofsActive);
  const paint = useMemo(() => paintFor(accessMode ? COLOR_BY_ACCESS : COLOR_BY_KIND, roofs), [accessMode, roofs]);
  return (
    <Source id={BUILDINGS_SOURCE} type="geojson" data={BUILDINGS_URL} promoteId="id">
      <Layer id={BUILDINGS_LAYER} type="fill-extrusion" beforeId={ANCHORS.scene3d} paint={paint} />
    </Source>
  );
}
