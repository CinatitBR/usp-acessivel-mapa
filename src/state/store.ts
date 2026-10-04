import { create } from 'zustand';
import type { AccessFeatureKind, LngLat, PoiCategory, RouteProfile } from '../domain/types';
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
  /** A moving bus: no fixed position, so no marker. `fromStop` is the stop whose arrivals it was opened from. */
  | { kind: 'bus'; id: string; fromStop?: string }
  | { kind: 'place'; label: string; detail?: string; position: LngLat };

export type RouteEnd = 'from' | 'to';
export type RoutePoint = { label: string; position: LngLat };
/** The route being planned. A route is requested once both ends are set. */
export type RoutePlan = {
  from: RoutePoint | null;
  to: RoutePoint | null;
  profile: RouteProfile;
  /** The end that the next map tap or search result fills in. */
  picking: RouteEnd | null;
};

type AppState = {
  mapStatus: MapStatus;
  setMapStatus: (status: MapStatus) => void;

  selection: Selection | null;
  /** A new object on every request, so flying twice to the same spot still triggers. */
  flyTarget: { position: LngLat; keepZoom?: boolean } | null;
  /**
   * Pass `flyTo` to move the camera to the selection. A selection from search zooms in if needed;
   * a symbol tapped on the map is only centred (`keepZoom`).
   */
  select: (selection: Selection, flyTo?: LngLat, keepZoom?: boolean) => void;
  clearSelection: () => void;
  /** Moves the camera without changing the selection. Following a bus pauses, or it would pull the camera back. */
  flyTo: (position: LngLat) => void;
  /** The camera keeps the selected bus centred. Starts on when the bus was opened from a stop's arrivals. */
  followBus: boolean;
  setFollowBus: (follow: boolean) => void;

  routePlan: RoutePlan | null;
  /** Opens the route panel, optionally with a destination. Starts step-free when the accessibility view is on. */
  startRoute: (to?: RoutePoint) => void;
  setRouteEnd: (end: RouteEnd, point: RoutePoint) => void;
  pickRouteEnd: (end: RouteEnd | null) => void;
  setRouteProfile: (profile: RouteProfile) => void;
  swapRouteEnds: () => void;
  closeRoute: () => void;

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
  /** The 3D scene is drawing shaped roofs, so the building layer stops its walls at the eaves. */
  roofsActive: boolean;
  setRoofsActive: (active: boolean) => void;
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

/** Points the plan at the end that is still missing, destination first. */
const withNextPick = (plan: RoutePlan): RoutePlan => ({ ...plan, picking: !plan.to ? 'to' : !plan.from ? 'from' : null });

export const useAppStore = create<AppState>((set) => ({
  mapStatus: 'loading',
  setMapStatus: (mapStatus) => set({ mapStatus }),

  selection: null,
  flyTarget: null,
  select: (selection, flyTo, keepZoom) => {
    const followBus = selection.kind === 'bus' && selection.fromStop !== undefined;
    set(flyTo ? { selection, followBus, flyTarget: { position: flyTo, keepZoom } } : { selection, followBus });
  },
  clearSelection: () => set({ selection: null, followBus: false }),
  flyTo: (position) => set({ flyTarget: { position }, followBus: false }),
  followBus: false,
  setFollowBus: (followBus) => set({ followBus }),

  routePlan: null,
  startRoute: (to) =>
    set((state) => ({
      selection: null,
      followBus: false,
      routePlan: withNextPick({
        from: state.routePlan?.from ?? null,
        to: to ?? state.routePlan?.to ?? null,
        profile: state.routePlan?.profile ?? (state.accessMode ? 'wheelchair' : 'walk'),
        picking: null,
      }),
    })),
  setRouteEnd: (end, point) =>
    set(({ routePlan }) => (routePlan ? { routePlan: withNextPick({ ...routePlan, [end]: point }) } : {})),
  pickRouteEnd: (picking) => set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, picking } } : {})),
  setRouteProfile: (profile) => set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, profile } } : {})),
  swapRouteEnds: () =>
    set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, from: routePlan.to, to: routePlan.from } } : {})),
  closeRoute: () => set({ routePlan: null }),

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
  roofsActive: false,
  setRoofsActive: (roofsActive) => set({ roofsActive }),
  busesUnavailable: false,
  setBusesUnavailable: (busesUnavailable) => set({ busesUnavailable }),

  toast: null,
  showToast: (toast) => set({ toast }),
  dismissToast: () => set({ toast: null }),
}));
