import { Layer, Source } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FillExtrusionLayerSpecification, FilterSpecification } from 'maplibre-gl';
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
  'university', '#fbf5e6',
  'dormitory', '#f8e9dc',
  'roof', '#e4e8ea',
  ['retail', 'commercial'], '#f3e8ef',
  ['greenhouse'], '#e1efde',
  '#f7f3ea',
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
  'fill-extrusion-opacity': 1,
  'fill-extrusion-vertical-gradient': true,
});

export function BuildingLayers() {
  const accessMode = useAppStore((state) => state.accessMode);
  const roofs = useAppStore((state) => state.roofsActive);
  // A building whose floor plan is open gives up its block.
  const indoorId = useAppStore((state) => state.indoor?.buildingId ?? '');
  const paint = useMemo(() => paintFor(accessMode ? COLOR_BY_ACCESS : COLOR_BY_KIND, roofs), [accessMode, roofs]);
  const filter = useMemo((): FilterSpecification => ['!=', ['get', 'id'], indoorId], [indoorId]);
  return (
    <Source id={BUILDINGS_SOURCE} type="geojson" data={BUILDINGS_URL} promoteId="id">
      <Layer id={BUILDINGS_LAYER} type="fill-extrusion" beforeId={ANCHORS.scene3d} paint={paint} filter={filter} />
    </Source>
  );
}
