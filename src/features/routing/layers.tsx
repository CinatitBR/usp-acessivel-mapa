import { Layer, Marker, Source, useMap } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import type { LineLayerSpecification } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import type { Journey, LngLat, Route } from '../../domain/types';
import { ANCHORS } from '../../map/anchors';
import { type RouteEnd, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { framePath } from './frame';
import { useJourneys } from './useJourneys';
import { useRoute } from './useRoute';
import { MAP_HALO, MAP_ROUTE, MAP_TEXT } from '../../styles/palette';

const ROUTE_COLOR = MAP_ROUTE;
const STAIRS_COLOR = '#d9480f';
const ENDS: RouteEnd[] = ['from', 'to'];
const END_LETTERS: Record<RouteEnd, string> = { from: 'A', to: 'B' };

const lineLayout: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };
const width = (base: number): LineLayerSpecification['paint'] => ({
  'line-width': ['interpolate', ['linear'], ['zoom'], 14, base * 0.6, 18, base],
});

/** The whole route as one line, plus one line per stretch of stairs. */
function routeFeatures(route: Route): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { stairs: false }, geometry: { type: 'LineString', coordinates: route.geometry } },
      ...route.steps
        .filter((step) => step.hasSteps && step.to > step.from)
        .map((step) => ({
          type: 'Feature' as const,
          properties: { stairs: true },
          geometry: { type: 'LineString' as const, coordinates: route.geometry.slice(step.from, step.to + 1) },
        })),
    ],
  };
}

/** One line per leg of a journey, and a point where each ride is boarded and left. */
function journeyFeatures(journey: Journey): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: journey.legs.flatMap((leg) => {
      const ride = leg.kind === 'transit';
      const line = { type: 'Feature' as const, properties: { ride, color: ride ? leg.color : undefined }, geometry: { type: 'LineString' as const, coordinates: leg.geometry } };
      const stops = ride ? [leg.from, leg.to].map(({ position }) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: position } })) : [];
      return [line, ...stops];
    }),
  };
}

/** Draws the planned route, or the journey whose details are open, with its two ends, and frames it when it arrives. */
export function RouteLayers() {
  const { current: map } = useMap();
  const plan = useAppStore((state) => state.routePlan);
  const route = useRoute(plan).data?.route;
  const journeys = useJourneys(plan).data;
  const journey = plan?.mode === 'transit' && plan.journey ? journeys?.find(({ id }) => id === plan.journey) : undefined;
  const features = useMemo(() => route && routeFeatures(route), [route]);
  const journeyLines = useMemo(() => journey && journeyFeatures(journey), [journey]);
  const path = useMemo<LngLat[] | undefined>(() => route?.geometry ?? journey?.legs.flatMap((leg) => leg.geometry), [route, journey]);

  useEffect(() => {
    if (!map || !path?.length) return;
    // The sheet has just changed size (see MapSelection).
    map.resize();
    framePath(map.getMap(), path);
  }, [map, path]);

  if (!plan) return null;
  return (
    <>
      {features && (
        <Source id="route" type="geojson" data={features}>
          <Layer id="route-casing" type="line" beforeId={ANCHORS.features} layout={lineLayout} paint={{ ...width(9), 'line-color': MAP_HALO }} />
          <Layer
            id="route-line"
            type="line"
            beforeId={ANCHORS.features}
            filter={['!', ['get', 'stairs']]}
            layout={lineLayout}
            paint={{ ...width(5), 'line-color': ROUTE_COLOR }}
          />
          {/* Stairs differ by pattern as well as colour. */}
          <Layer
            id="route-stairs"
            type="line"
            beforeId={ANCHORS.features}
            filter={['get', 'stairs']}
            paint={{ ...width(6), 'line-color': STAIRS_COLOR, 'line-dasharray': [0.6, 0.6] }}
          />
        </Source>
      )}
      {journeyLines && (
        <Source id="journey" type="geojson" data={journeyLines}>
          <Layer
            id="journey-casing"
            type="line"
            beforeId={ANCHORS.features}
            filter={['==', ['geometry-type'], 'LineString']}
            layout={lineLayout}
            paint={{ ...width(9), 'line-color': MAP_HALO }}
          />
          {/* A ride is in its line's own colour; a walk is dotted, so the two differ by pattern as well. */}
          <Layer
            id="journey-ride"
            type="line"
            beforeId={ANCHORS.features}
            filter={['all', ['==', ['geometry-type'], 'LineString'], ['get', 'ride']]}
            layout={lineLayout}
            paint={{ ...width(5), 'line-color': ['coalesce', ['get', 'color'], ROUTE_COLOR] }}
          />
          <Layer
            id="journey-walk"
            type="line"
            beforeId={ANCHORS.features}
            filter={['all', ['==', ['geometry-type'], 'LineString'], ['!', ['get', 'ride']]]}
            layout={lineLayout}
            paint={{ ...width(5), 'line-color': ROUTE_COLOR, 'line-dasharray': [0.1, 1.8] }}
          />
          <Layer
            id="journey-stops"
            type="circle"
            beforeId={ANCHORS.features}
            filter={['==', ['geometry-type'], 'Point']}
            paint={{ 'circle-radius': 5, 'circle-color': MAP_HALO, 'circle-stroke-color': MAP_TEXT, 'circle-stroke-width': 2 }}
          />
        </Source>
      )}
      {ENDS.map((end) => {
        const point = plan[end];
        return point && (
          <Marker key={end} longitude={point.position[0]} latitude={point.position[1]} anchor="center">
            <span className={`route-marker route-marker-${end}`} aria-label={`${strings.route[end]}: ${point.label}`}>
              {END_LETTERS[end]}
            </span>
          </Marker>
        );
      })}
    </>
  );
}
