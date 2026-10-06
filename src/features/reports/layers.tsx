import { Layer, Source, useMap } from '@vis.gl/react-maplibre';
import type { FeatureCollection, Point } from 'geojson';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useState } from 'react';
import { isTemporary, type Report } from '../../domain/reports';
import { ANCHORS } from '../../map/anchors';
import { SELECTED_SUFFIX } from '../../map/badgeIcon';
import { useAppStore } from '../../state/store';
import { addReportIcons, PENDING_SUFFIX, reportIconId } from './icons';
import { useReports } from './useReports';
import { useRouteWarnings } from './useRouteWarnings';

export const REPORTS_LAYER = 'reports';
export const REPORTS_SELECTED_LAYER = 'reports-selected';
export const MY_REPORTS_LAYER = 'my-reports';
export const MY_REPORTS_SELECTED_LAYER = 'my-reports-selected';

const MIN_ZOOM = 14;

type ReportProperties = { id: string; icon: string; temporary: boolean; rank: number };

/** Where two reports share a spot the worse one is drawn: lower ranks are placed first. */
const RANK: Record<Report['answer'], number> = { no: 0, broken: 0, closed: 0, missing: 0, help: 1, yes: 2 };

export const reportFeatures = (reports: readonly Report[]): FeatureCollection<Point, ReportProperties> => ({
  type: 'FeatureCollection',
  features: reports.map((report) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: report.position },
    properties: { id: report.id, icon: reportIconId(report), temporary: isTemporary(report), rank: RANK[report.answer] },
  })),
});

/** Reports on the planned route are drawn this much larger. */
const ON_ROUTE_SCALE = 1.35;

const baseLayout: SymbolLayerSpecification['layout'] = {
  'icon-image': ['get', 'icon'],
  'symbol-sort-key': ['get', 'rank'],
  // Reports give way to one another, but never to other symbols, and never hide them.
  'icon-ignore-placement': true,
};

/** The layout with the symbols' size: growing with the zoom, and larger for the reports with these ids. */
const sized = (layout: SymbolLayerSpecification['layout'], larger: readonly string[]): SymbolLayerSpecification['layout'] => ({
  ...layout,
  'icon-size': [
    'interpolate', ['linear'], ['zoom'],
    MIN_ZOOM, ['case', ['in', ['get', 'id'], ['literal', larger]], 0.6 * ON_ROUTE_SCALE, 0.6],
    18, ['case', ['in', ['get', 'id'], ['literal', larger]], ON_ROUTE_SCALE, 1],
  ],
});

const selectedLayout: SymbolLayerSpecification['layout'] = {
  'icon-image': ['concat', ['get', 'icon'], SELECTED_SUFFIX],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};

const mineLayout: SymbolLayerSpecification['layout'] = {
  'icon-image': ['concat', ['get', 'icon'], PENDING_SUFFIX],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};

const mineSelectedLayout: SymbolLayerSpecification['layout'] = {
  ...selectedLayout,
  'icon-image': ['concat', ['get', 'icon'], PENDING_SUFFIX, SELECTED_SUFFIX],
};

/**
 * Published reports. Temporary ones (triangles) are always drawn, unless switched off in the
 * layer menu; permanent ones are part of the accessibility view. The person's own reports,
 * not reviewed yet, are always drawn, hollow. The selected one is drawn larger, with a ring.
 */
export function ReportLayers() {
  const { current: map } = useMap();
  const reports = useReports();
  const mine = useAppStore((state) => state.myReports);
  const accessMode = useAppStore((state) => state.accessMode);
  const showTemporary = useAppStore((state) => state.reportsVisible);
  const selectedId = useAppStore((state) => (state.selection?.kind === 'report' ? state.selection.id : ''));
  // Images can only be added once the style is in place (see AccessibilityLayers).
  const mapReady = useAppStore((state) => state.mapStatus === 'ready');
  const [iconsReady, setIconsReady] = useState(false);
  const data = useMemo(() => reportFeatures(reports), [reports]);
  const mineData = useMemo(() => reportFeatures(mine), [mine]);
  const any = reports.length + mine.length > 0;
  const warnings = useRouteWarnings();
  const onRoute = useMemo(() => warnings.map(({ report }) => report.id), [warnings]);
  const layout = useMemo(() => sized(baseLayout, onRoute), [onRoute]);
  const ownLayout = useMemo(() => sized(mineLayout, onRoute), [onRoute]);

  useEffect(() => {
    if (!map || !mapReady || !any) return;
    addReportIcons(map);
    setIconsReady(true);
  }, [map, mapReady, any]);

  if (!iconsReady || !any) return null;

  const isSelected: FilterSpecification = ['==', ['get', 'id'], selectedId];
  // What the route passes is drawn whatever the view: a step matters on a step-free route even with the accessibility view off.
  const isOnRoute: FilterSpecification = ['in', ['get', 'id'], ['literal', onRoute]];
  const shown: FilterSpecification = ['any', isOnRoute, ['case', ['get', 'temporary'], showTemporary, accessMode]];
  return (
    <>
      <Source id="reports" type="geojson" data={data}>
        <Layer id={REPORTS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={layout} filter={['all', shown, ['!', isSelected]]} />
        <Layer id={REPORTS_SELECTED_LAYER} type="symbol" beforeId={ANCHORS.labels} layout={selectedLayout} filter={isSelected} />
      </Source>
      <Source id="my-reports" type="geojson" data={mineData}>
        <Layer id={MY_REPORTS_LAYER} type="symbol" beforeId={ANCHORS.labels} minzoom={MIN_ZOOM} layout={ownLayout} filter={['!', isSelected]} />
        <Layer id={MY_REPORTS_SELECTED_LAYER} type="symbol" beforeId={ANCHORS.labels} layout={mineSelectedLayout} filter={isSelected} />
      </Source>
    </>
  );
}
