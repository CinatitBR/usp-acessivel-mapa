import { Component, type ReactNode, Suspense } from 'react';
import { AccessFeaturePanel } from '../features/accessibility/AccessFeaturePanel';
import { BuildingPanel } from '../features/buildings/BuildingPanel';
import { RoomPanel } from '../features/indoor/RoomPanel';
import { InstitutePanel } from '../features/institutes/InstitutePanel';
import { PoiPanel } from '../features/pois/PoiPanel';
import { RoutePanel } from '../features/routing/RoutePanel';
import { BusPanel } from '../features/transit/BusPanel';
import { StopPanel } from '../features/transit/StopPanel';
import { type Selection, useAppStore } from '../state/store';
import { strings } from '../strings/pt-BR';
import { BottomSheet } from './BottomSheet';

/** Shows a message in the sheet when the campus data cannot be loaded; the map keeps working. */
class DataBoundary extends Component<{ onClose: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <BottomSheet title={strings.dataError} onClose={this.props.onClose} />
      : this.props.children;
  }
}

function panelFor(selection: Selection, onClose: () => void) {
  switch (selection.kind) {
    case 'building':
      return <BuildingPanel id={selection.id} />;
    case 'institute':
      return <InstitutePanel id={selection.id} />;
    case 'poi':
      return <PoiPanel id={selection.id} />;
    case 'access':
      return <AccessFeaturePanel id={selection.id} />;
    case 'stop':
      return <StopPanel id={selection.id} />;
    case 'room':
      return <RoomPanel id={selection.id} buildingId={selection.buildingId} />;
    case 'bus':
      return <BusPanel id={selection.id} {...(selection.fromStop !== undefined && { fromStop: selection.fromStop })} />;
    case 'place':
      return (
        <BottomSheet
          title={selection.label}
          subtitle={strings.place.offCampus}
          onClose={onClose}
          routeTo={{ label: selection.label, position: selection.position }}
        >
          {selection.detail && <p className="muted">{selection.detail}</p>}
        </BottomSheet>
      );
  }
}

export function SelectionSheet() {
  const selection = useAppStore((state) => state.selection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const routePlan = useAppStore((state) => state.routePlan);
  // A selection made while planning a route covers the route panel until it is closed.
  if (!selection) return routePlan ? <RoutePanel plan={routePlan} /> : null;

  // Keyed so a failed load is retried on the next selection.
  const key = selection.kind === 'place' ? selection.label : selection.id;
  return (
    <DataBoundary key={key} onClose={clearSelection}>
      <Suspense fallback={<BottomSheet title={strings.loading} onClose={clearSelection} />}>
        {panelFor(selection, clearSelection)}
      </Suspense>
    </DataBoundary>
  );
}
