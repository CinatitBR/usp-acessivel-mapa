import { Layer, Source } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FillExtrusionLayerSpecification } from 'maplibre-gl';
import { ACCESS_COLORS } from '../../domain/access';
import { ANCHORS } from '../../map/anchors';
import { dataUrl } from '../../map/staticData';
import { useAppStore } from '../../state/store';

export const BUILDINGS_SOURCE = 'buildings';
export const BUILDINGS_LAYER = 'buildings-3d';

const BUILDINGS_URL = dataUrl('buildings.geojson');
const SELECTED_COLOR = '#f59e0b';

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

/** Unknown stays pale so the buildings somebody surveyed stand out. */
const COLOR_BY_ACCESS: ExpressionSpecification = [
  'match',
  ['get', 'acc'],
  'y', ACCESS_COLORS.yes,
  'p', ACCESS_COLORS.partial,
  'n', ACCESS_COLORS.no,
  '#cfd4d9',
];

const paintFor = (color: ExpressionSpecification): FillExtrusionLayerSpecification['paint'] => ({
  'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'selected'], false], SELECTED_COLOR, color],
  'fill-extrusion-height': ['get', 'h'],
  'fill-extrusion-base': ['get', 'mh'],
  'fill-extrusion-opacity': 0.92,
  'fill-extrusion-vertical-gradient': true,
});
const PAINT_BY_KIND = paintFor(COLOR_BY_KIND);
const PAINT_BY_ACCESS = paintFor(COLOR_BY_ACCESS);

export function BuildingLayers() {
  const accessMode = useAppStore((state) => state.accessMode);
  const paint = accessMode ? PAINT_BY_ACCESS : PAINT_BY_KIND;
  return (
    <Source id={BUILDINGS_SOURCE} type="geojson" data={BUILDINGS_URL} promoteId="id">
      <Layer id={BUILDINGS_LAYER} type="fill-extrusion" beforeId={ANCHORS.scene3d} paint={paint} />
    </Source>
  );
}
