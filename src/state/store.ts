import { create } from 'zustand';
import type { AccessFeatureKind, LngLat, PoiCategory } from '../domain/types';
import {
  type LiteChoice,
  readDeviceHints,
  readLiteChoice,
  resolveLite,
  shouldStartLite,
  storeLiteChoice,
} from '../features/litemode/detect';
import { readPoiCategories, storePoiCategories, togglePoiCategory } from '../features/pois/visibility';

export type MapStatus = 'loading' | 'ready' | 'error';

/** What the detail sheet shows. Buildings are highlighted in place; the others get a marker. */
export type Selection =
  | { kind: 'building'; id: string }
  | { kind: 'poi'; id: string; position: LngLat }
  | { kind: 'institute'; id: string; position: LngLat }
  | { kind: 'access'; id: string; position: LngLat }
  | { kind: 'stop'; id: string; position: LngLat }
  /** A moving bus: no fixed position, so no marker. */
  | { kind: 'bus'; id: string }
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

  /** POI categories drawn on the map, chosen in the layer menu and remembered on this device. */
  poiCategories: readonly PoiCategory[];
  togglePoiCategory: (category: PoiCategory) => void;

  /** The user's explicit choice for lite mode (no Three.js layer); `auto` follows the device. */
  liteChoice: LiteChoice;
  setLiteChoice: (choice: LiteChoice) => void;
  /** The device looked too weak for 3D at startup. */
  liteDetected: boolean;
  /** 3D ran too slowly during this visit. */
  watchdogTripped: boolean;
  tripWatchdog: () => void;
  /** True while the Three.js layer is on the map. */
  scene3dActive: boolean;
  setScene3dActive: (active: boolean) => void;
  /** Live bus positions could not be fetched. */
  busesUnavailable: boolean;
  setBusesUnavailable: (unavailable: boolean) => void;

  toast: Toast | null;
  showToast: (toast: Toast) => void;
  dismissToast: () => void;
};

/** `sticky` toasts stay until dismissed or replaced. */
export type Toast = { message: string; actionLabel?: string; action?: () => void; sticky?: boolean };

/** Lite mode is on: no trees, flat buses, and the 3D code is not even downloaded. */
export const selectLite = (state: AppState) => resolveLite(state.liteChoice, state.liteDetected, state.watchdogTripped);

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

  poiCategories: readPoiCategories(),
  togglePoiCategory: (category) =>
    set((state) => {
      const poiCategories = togglePoiCategory(state.poiCategories, category);
      storePoiCategories(poiCategories);
      return { poiCategories };
    }),

  liteChoice: readLiteChoice(),
  setLiteChoice: (liteChoice) => {
    storeLiteChoice(liteChoice);
    set({ liteChoice });
  },
  liteDetected: shouldStartLite(readDeviceHints()),
  watchdogTripped: false,
  tripWatchdog: () => set({ watchdogTripped: true }),
  scene3dActive: false,
  setScene3dActive: (scene3dActive) => set({ scene3dActive }),
  busesUnavailable: false,
  setBusesUnavailable: (busesUnavailable) => set({ busesUnavailable }),

  toast: null,
  showToast: (toast) => set({ toast }),
  dismissToast: () => set({ toast: null }),
}));
