import { useEffect, useMemo, useState } from 'react';
import type { AccessibilityFeature, Building } from '../../domain/types';
import { loadAccessFeatures, loadBuildings } from '../../map/staticData';
import { useAppStore } from '../../state/store';
import { useRoute } from '../routing/useRoute';
import { nearestOnLine, reportsOnRoute, type RouteWarning } from './onRoute';
import { useReports } from './useReports';

const NONE: RouteWarning[] = [];
/** A route "to a building" ends at the building's own centre. */
const SAME_PLACE_METERS = 2;

/**
 * The reports that concern the planned route: published ones, and the person's own that are
 * still waiting for review, which warn only them. Empty while there is no route.
 */
export function useRouteWarnings(): RouteWarning[] {
  const plan = useAppStore((state) => state.routePlan);
  const mine = useAppStore((state) => state.myReports);
  const published = useReports();
  const route = useRoute(plan).data?.route;
  // Buildings and accessibility points tell which building a report belongs to; warnings on the way work without them.
  const [places, setPlaces] = useState<{ buildings: Building[]; features: AccessibilityFeature[] }>();
  useEffect(() => {
    Promise.all([loadBuildings(), loadAccessFeatures()]).then(([buildings, features]) => setPlaces({ buildings, features }), () => undefined);
  }, []);

  const to = plan?.to?.position;
  return useMemo(() => {
    if (!route || !to) return NONE;
    const destination = places?.buildings.find((building) => nearestOnLine(building.center, [to, to]).distance <= SAME_PLACE_METERS);
    const isBuilding = (id: string | undefined) => id !== undefined && places?.buildings.some((building) => building.id === id);
    const warnings = reportsOnRoute(route.geometry, route.profile, [...published, ...mine], { position: to, buildingId: destination?.id }, (report) =>
      isBuilding(report.target) ? report.target : places?.features.find((feature) => feature.id === report.target)?.buildingId,
    );
    return warnings.length > 0 ? warnings : NONE;
  }, [route, to, places, published, mine]);
}
