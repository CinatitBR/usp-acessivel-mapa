import { Layer, Marker, Source, useMap } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import type { LineLayerSpecification } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import type { Route } from '../../domain/types';
import { ANCHORS } from '../../map/anchors';
import { type RouteEnd, useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { useRoute } from './useRoute';
import { MAP_HALO, MAP_ROUTE } from '../../styles/palette';

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

/** Draws the planned route and its two ends, and frames the route when it arrives. */
export function RouteLayers() {
  const { current: map } = useMap();
  const plan = useAppStore((state) => state.routePlan);
  const route = useRoute(plan).data?.route;
  const features = useMemo(() => route && routeFeatures(route), [route]);

  useEffect(() => {
    if (!map || !route) return;
    let [west, south] = route.geometry[0]!;
    let [east, north] = [west, south];
    for (const [lng, lat] of route.geometry) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    // The sheet has just changed size (see MapSelection).
    map.resize();
    // Extra room at the top and right keeps the route clear of the search box and the map buttons.
    map.fitBounds([west, south, east, north], { padding: { top: 120, right: 70, bottom: 50, left: 40 }, maxZoom: 18 });
  }, [map, route]);

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
