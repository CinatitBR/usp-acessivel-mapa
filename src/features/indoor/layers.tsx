import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { FillLayerSpecification, FilterSpecification, LineLayerSpecification } from 'maplibre-gl';
import { useEffect } from 'react';
import { ANCHORS } from '../../map/anchors';
import { zoomToFit } from './camera';
import { useOpenPlan } from './usePlan';

export const INDOOR_SLAB_LAYER = 'indoor-slab';

/** How long the camera takes to come over the building, and to go back. */
const CAMERA_MS = 800;
const slabPaint: FillLayerSpecification['paint'] = { 'fill-color': '#fbf8f1' };
const edgePaint: LineLayerSpecification['paint'] = { 'line-color': '#8a8073', 'line-width': 1.5 };
const wallPaint: LineLayerSpecification['paint'] = {
  'line-color': '#5b5348',
  'line-width': ['interpolate', ['exponential', 2], ['zoom'], 16, 0.3, 18, 0.7, 21, 2.5],
};

/**
 * The floor plan of the building whose indoor map is open: a slab and the walls of one floor,
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

  if (!open) return null;
  const onLevel: FilterSpecification = ['==', ['get', 'level'], open.level.id];
  return (
    <>
      <Source id="indoor-slabs" type="geojson" data={open.plan.slabs}>
        <Layer id={INDOOR_SLAB_LAYER} type="fill" beforeId={ANCHORS.features} paint={slabPaint} filter={onLevel} />
        <Layer id="indoor-slab-edge" type="line" beforeId={ANCHORS.features} paint={edgePaint} filter={onLevel} />
      </Source>
      <Source id="indoor-walls" type="geojson" data={open.plan.walls}>
        <Layer id="indoor-walls" type="line" beforeId={ANCHORS.features} paint={wallPaint} filter={onLevel} />
      </Source>
    </>
  );
}
