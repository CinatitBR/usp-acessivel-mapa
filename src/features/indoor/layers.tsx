import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification, FillLayerSpecification, FilterSpecification, LineLayerSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import type { RoomCategory } from '../../domain/indoor';
import { ANCHORS } from '../../map/anchors';
import { useAppStore } from '../../state/store';
import { zoomToFit } from './camera';
import { useOpenPlan } from './usePlan';

export const INDOOR_SLAB_LAYER = 'indoor-slab';
export const INDOOR_ROOMS_LAYER = 'indoor-rooms';

/** Places one walks through or past: they cannot be selected, and their names come last. */
export const PASSAGE_CATEGORIES: readonly RoomCategory[] = ['circulation', 'ramp', 'stairs', 'elevator', 'void'];

const ROOM_COLORS: Record<RoomCategory, string> = {
  classroom: '#f8d7a4',
  studio: '#f5c2a0',
  laboratory: '#bfe3cf',
  library: '#c6d6f1',
  museum: '#d8cbed',
  auditorium: '#f1b9b7',
  administration: '#f2e39c',
  department: '#d3e7ae',
  food: '#fbcf8e',
  services: '#e7d2c1',
  bathroom: '#bcdfee',
  hall: '#f7edcf',
  circulation: '#f1ece2',
  ramp: '#e2dccf',
  stairs: '#d8d1c3',
  elevator: '#cdc5b6',
  void: '#ffffff',
  technical: '#dcdad6',
};

const ROOM_COLOR = ['match', ['get', 'cat'], ...Object.entries(ROOM_COLORS).flat(), '#eeeeee'] as unknown as ExpressionSpecification;
const NAME: ExpressionSpecification = ['get', 'name'];
const IS_PASSAGE: ExpressionSpecification = ['in', ['get', 'cat'], ['literal', PASSAGE_CATEGORIES]];
/** The name of a room of at least `area` square metres that is not a passage. */
const nameFrom = (area: number): ExpressionSpecification => ['case', ['all', ['>=', ['get', 'area'], area], ['!', IS_PASSAGE]], NAME, ''];

const roomPaint: FillLayerSpecification['paint'] = { 'fill-color': ROOM_COLOR };
const selectedPaint: LineLayerSpecification['paint'] = { 'line-color': '#0b57a4', 'line-width': 3 };
const nameLayout: SymbolLayerSpecification['layout'] = {
  // Large rooms are named first; every room has its name from zoom 19.5.
  'text-field': ['step', ['zoom'], '', 17, nameFrom(350), 18.2, nameFrom(60), 19, nameFrom(20), 19.6, NAME],
  'text-font': ['Noto Sans Regular'],
  'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10.5, 20, 13],
  'text-max-width': 7,
  'symbol-sort-key': ['-', ['get', 'area']],
};
const namePaint: SymbolLayerSpecification['paint'] = { 'text-color': '#3b352c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 };

/** How long the camera takes to come over the building, and to go back. */
const CAMERA_MS = 800;
const slabPaint: FillLayerSpecification['paint'] = { 'fill-color': '#fbf8f1' };
const edgePaint: LineLayerSpecification['paint'] = { 'line-color': '#8a8073', 'line-width': 1.5 };
const wallPaint: LineLayerSpecification['paint'] = {
  'line-color': '#5b5348',
  'line-width': ['interpolate', ['exponential', 2], ['zoom'], 16, 0.3, 18, 0.7, 21, 2.5],
};

/**
 * The floor plan of the building whose indoor map is open: a slab, the rooms and the walls of one floor,
 * flat on the ground where its 3D block was. The camera comes over it looking straight down,
 * turned the way the plan was drawn, and goes back to its zoom and angle when the plan is closed.
 */
export function IndoorLayers() {
  const { current: map } = useMap();
  const open = useOpenPlan();
  const plan = open?.plan;

  useEffect(() => {
    if (!map || !plan) return;
    const before = { zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    // The building's panel has just changed the map's size.
    map.resize();
    const { clientWidth, clientHeight } = map.getContainer();
    const zoom = zoomToFit(plan.size, [clientWidth, clientHeight], plan.center[1]);
    map.easeTo({ center: plan.center, zoom, bearing: plan.bearing, pitch: 0, duration: CAMERA_MS });
    return () => {
      map.easeTo({ ...before, duration: CAMERA_MS });
    };
  }, [map, plan]);

  const selectedId = useAppStore((state) => (state.selection?.kind === 'room' ? state.selection.id : ''));
  const levelId = open?.level.id;
  const onLevel = useMemo((): FilterSpecification => ['==', ['get', 'level'], levelId ?? 0], [levelId]);
  const selected = useMemo((): FilterSpecification => ['==', ['get', 'id'], selectedId], [selectedId]);
  if (!open) return null;
  return (
    <>
      <Source id="indoor-slabs" type="geojson" data={open.plan.slabs}>
        <Layer id={INDOOR_SLAB_LAYER} type="fill" beforeId={ANCHORS.features} paint={slabPaint} filter={onLevel} />
        <Layer id="indoor-slab-edge" type="line" beforeId={ANCHORS.features} paint={edgePaint} filter={onLevel} />
      </Source>
      <Source id="indoor-rooms" type="geojson" data={open.plan.rooms}>
        <Layer id={INDOOR_ROOMS_LAYER} type="fill" beforeId={ANCHORS.features} paint={roomPaint} filter={onLevel} />
        <Layer id="indoor-room-selected" type="line" beforeId={ANCHORS.features} paint={selectedPaint} filter={selected} />
        <Layer id="indoor-room-names" type="symbol" beforeId={ANCHORS.labels} layout={nameLayout} paint={namePaint} filter={onLevel} />
      </Source>
      <Source id="indoor-walls" type="geojson" data={open.plan.walls}>
        <Layer id="indoor-walls" type="line" beforeId={ANCHORS.features} paint={wallPaint} filter={onLevel} />
      </Source>
    </>
  );
}
