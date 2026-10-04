import { create } from 'zustand';
import type { AccessFeatureKind, LngLat } from '../domain/types';

export type MapStatus = 'loading' | 'ready' | 'error';

/** What the detail sheet shows. Buildings are highlighted in place; the others get a marker. */
export type Selection =
  | { kind: 'building'; id: string }
  | { kind: 'poi'; id: string; position: LngLat }
  | { kind: 'institute'; id: string; position: LngLat }
  | { kind: 'access'; id: string; position: LngLat }
  | { kind: 'place'; label: string; detail?: string; position: LngLat };

type AppState = {
  mapStatus: MapStatus;
  setMapStatus: (status: MapStatus) => void;

  selection: Selection | null;
  /** A new object on every request, so flying twice to the same spot still triggers. */
  flyTarget: { position: LngLat } | null;
  /** Pass `flyTo` when the selection did not come from a tap on the map. */
  select: (selection: Selection, flyTo?: LngLat) => void;
  clearSelection: () => void;

  /** Accessibility view: buildings coloured by status, plus ramps, elevators and the like. */
  accessMode: boolean;
  toggleAccessMode: () => void;
  /** Kinds the user switched off in the legend. */
  hiddenAccessKinds: readonly AccessFeatureKind[];
  toggleAccessKind: (kind: AccessFeatureKind) => void;
};

export const useAppStore = create<AppState>((set) => ({
  mapStatus: 'loading',
  setMapStatus: (mapStatus) => set({ mapStatus }),

  selection: null,
  flyTarget: null,
  select: (selection, flyTo) => set(flyTo ? { selection, flyTarget: { position: flyTo } } : { selection }),
  clearSelection: () => set({ selection: null }),

  accessMode: false,
  toggleAccessMode: () => set((state) => ({ accessMode: !state.accessMode })),
  hiddenAccessKinds: [],
  toggleAccessKind: (kind) =>
    set(({ hiddenAccessKinds: hidden }) => ({
      hiddenAccessKinds: hidden.includes(kind) ? hidden.filter((other) => other !== kind) : [...hidden, kind],
    })),
}));
