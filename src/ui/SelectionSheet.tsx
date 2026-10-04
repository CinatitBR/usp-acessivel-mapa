import { Component, type ReactNode, Suspense } from 'react';
import { BuildingPanel } from '../features/buildings/BuildingPanel';
import { InstitutePanel } from '../features/institutes/InstitutePanel';
import { PoiPanel } from '../features/pois/PoiPanel';
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
    case 'place':
      return (
        <BottomSheet title={selection.label} subtitle={strings.place.offCampus} onClose={onClose}>
          {selection.detail && <p className="muted">{selection.detail}</p>}
        </BottomSheet>
      );
  }
}

export function SelectionSheet() {
  const selection = useAppStore((state) => state.selection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  if (!selection) return null;

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
