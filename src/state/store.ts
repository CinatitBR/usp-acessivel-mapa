import { create } from 'zustand';
import type { AccessFeatureKind, LngLat, PoiCategory, RouteMode } from '../domain/types';
import {
  type LiteChoice,
  readDeviceHints,
  readLiteChoice,
  resolveLite,
  shouldStartLite,
  storeLiteChoice,
} from '../features/litemode/detect';
import type { Snap } from '../ui/sheetSnap';
import { draftFor, movedTo, type MyReport, type ReportAnswer, type ReportDraft, type ReportPlace, type ReportType } from '../domain/reports';
import { readMine, storeMine } from '../features/reports/mine';
import { today } from '../features/reports/today';
import { readReportsVisible, storeReportsVisible } from '../features/reports/visibility';
import { readPoiCategories, storePoiCategories, togglePoiCategory } from '../features/pois/visibility';

export type MapStatus = 'loading' | 'ready' | 'error';

/** What the detail sheet shows. Buildings are highlighted in place; the others get a marker. */
export type Selection =
  | { kind: 'building'; id: string }
  | { kind: 'poi'; id: string; position: LngLat }
  | { kind: 'institute'; id: string; position: LngLat }
  | { kind: 'access'; id: string; position: LngLat }
  | { kind: 'stop'; id: string; position: LngLat }
  /** A report published on the map. */
  | { kind: 'report'; id: string; position: LngLat }
  /**
   * A moving bus: no fixed position, so no marker. `fromStop` is the stop whose arrivals it was opened from,
   * or where a journey boards it; `fromJourney` says it was opened from the details of that journey.
   */
  | { kind: 'bus'; id: string; fromStop?: string; fromJourney?: boolean }
  /** A room of the open floor plan; it is highlighted in place. */
  | { kind: 'room'; id: string; buildingId: string }
  /** A visual route of a university unit (`unit` is its id in the campus backend), and the panel it was opened from. */
  | { kind: 'visualRoute'; id: string; unit: string; from: { kind: 'building' | 'institute'; id: string } }
  | { kind: 'place'; label: string; detail?: string; position: LngLat };

export type RouteEnd = 'from' | 'to';
export type RoutePoint = { label: string; position: LngLat };
/** The route being planned. A route is requested once both ends are set. */
export type RoutePlan = {
  from: RoutePoint | null;
  to: RoutePoint | null;
  mode: RouteMode;
  time: RouteTime;
  /** The journey by public transport whose details are open; null while the list of journeys shows. */
  journey: string | null;
};
/** When to travel: leaving now, leaving at a moment or arriving by it (`at`, epoch milliseconds). */
export type RouteTime = { kind: 'now' } | { kind: 'depart' | 'arrive'; at: number };

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
  /** Asks the map to put the camera back where it was when the bus was opened. A new object on every request. */
  cameraReturn: object | null;
  returnCamera: () => void;

  /**
   * The building whose floor plan is drawn in place of its 3D block. `level` is null until
   * the user picks a floor: the plan's default one shows.
   */
  indoor: { buildingId: string; plan: string; level: number | null } | null;
  openIndoor: (buildingId: string, plan: string) => void;
  setIndoorLevel: (level: number) => void;
  closeIndoor: () => void;

  routePlan: RoutePlan | null;
  /** Opens the route panel, optionally with a destination. Starts step-free when the accessibility view is on. */
  startRoute: (to?: RoutePoint) => void;
  setRouteEnd: (end: RouteEnd, point: RoutePoint) => void;
  setRouteMode: (mode: RouteMode) => void;
  setRouteTime: (time: RouteTime) => void;
  /** Opens the details of a journey, or goes back to the list with null. */
  openJourney: (id: string | null) => void;
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

  /** The report being written, shown in place of any other panel. */
  reportDraft: ReportDraft | null;
  /** Starts a report about a thing on the map, or with the place still to be tapped. */
  startReport: (place?: ReportPlace) => void;
  /** A tap on the map while a report is being written. Ignored when the report is about a fixed thing. */
  setReportPlace: (place: ReportPlace) => void;
  setReportType: (type: ReportType | null) => void;
  setReportAnswer: (answer: ReportAnswer | null) => void;
  closeReport: () => void;
  /** The person's own reports, kept on this device until they are reviewed. */
  myReports: readonly MyReport[];
  addMyReport: (report: MyReport) => void;
  /** `publishedId` is the id the Worker gave it, which replaces the one made on the device. */
  markReportSent: (id: string, publishedId?: string) => void;
  /** `keepSelection`: its sheet stays open, for a report that goes on as a published one. */
  removeMyReport: (id: string, keepSelection?: boolean) => void;

  /** Temporary reports (works, a broken elevator) are drawn on the map; remembered on this device. */
  reportsVisible: boolean;
  toggleReportsVisible: () => void;

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

  /** Pixels of the map's bottom that the sheet covers on a phone, once it rests; 0 beside the map. */
  sheetCover: number;
  setSheetCover: (cover: number) => void;
  /** Asks the open sheet to go to a rest: out of the way of a floor plan, or up for typing. A new object each time. */
  sheetRequest: { snap: Snap } | null;
  requestSheet: (snap: Snap) => void;

  toast: Toast | null;
  showToast: (toast: Toast) => void;
  dismissToast: () => void;
};

/** `sticky` toasts stay until dismissed or replaced. */
export type Toast = { message: string; actionLabel?: string; action?: () => void; sticky?: boolean };

/** Lite mode is on: no trees, flat buses, and the 3D code is not even downloaded. */
export const selectLite = (state: AppState) => resolveLite(state.liteChoice, state.liteDetected, state.watchdogTripped);

/** Writes the person's own reports to the device and gives them back. */
const saved = (mine: MyReport[]) => {
  storeMine(mine);
  return mine;
};

export const useAppStore = create<AppState>((set) => ({
  mapStatus: 'loading',
  setMapStatus: (mapStatus) => set({ mapStatus }),

  selection: null,
  flyTarget: null,
  select: (selection, flyTo, keepZoom) => {
    const followBus = selection.kind === 'bus' && selection.fromStop !== undefined;
    set((state) => ({
      selection,
      followBus,
      ...(flyTo && { flyTarget: { position: flyTo, keepZoom } }),
      // Opening another building puts the first one's block back.
      ...(selection.kind === 'building' && state.indoor && state.indoor.buildingId !== selection.id && { indoor: null }),
    }));
  },
  clearSelection: () => set({ selection: null, followBus: false }),
  flyTo: (position) => set({ flyTarget: { position }, followBus: false }),
  followBus: false,
  setFollowBus: (followBus) => set({ followBus }),
  cameraReturn: null,
  returnCamera: () => set({ cameraReturn: {}, followBus: false }),

  indoor: null,
  // The floor plan needs the map: the building's sheet steps aside.
  openIndoor: (buildingId, plan) => set({ indoor: { buildingId, plan, level: null }, sheetRequest: { snap: 'collapsed' } }),
  // A selected room belongs to the floor that was showing, so it goes with it.
  setIndoorLevel: (level) =>
    set(({ indoor, selection }) => (indoor ? { indoor: { ...indoor, level }, ...(selection?.kind === 'room' && { selection: null }) } : {})),
  closeIndoor: () => set(({ selection }) => ({ indoor: null, ...(selection?.kind === 'room' && { selection: null }) })),

  routePlan: null,
  startRoute: (to) =>
    set((state) => ({
      selection: null,
      followBus: false,
      routePlan: {
        from: state.routePlan?.from ?? null,
        to: to ?? state.routePlan?.to ?? null,
        mode: state.routePlan?.mode ?? (state.accessMode ? 'wheelchair' : 'walk'),
        time: state.routePlan?.time ?? { kind: 'now' },
        // The journeys of another destination are other journeys.
        journey: to ? null : (state.routePlan?.journey ?? null),
      },
    })),
  setRouteEnd: (end, point) =>
    set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, [end]: point, journey: null } } : {})),
  setRouteMode: (mode) => set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, mode, journey: null } } : {})),
  setRouteTime: (time) => set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, time, journey: null } } : {})),
  openJourney: (journey) => set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, journey } } : {})),
  swapRouteEnds: () =>
    set(({ routePlan }) => (routePlan ? { routePlan: { ...routePlan, from: routePlan.to, to: routePlan.from, journey: null } } : {})),
  closeRoute: () => set({ routePlan: null }),

  accessMode: false,
  toggleAccessMode: () => set((state) => ({ accessMode: !state.accessMode })),
  hiddenAccessKinds: [],
  toggleAccessKind: (kind) =>
    set(({ hiddenAccessKinds: hidden }) => ({
      hiddenAccessKinds: hidden.includes(kind) ? hidden.filter((other) => other !== kind) : [...hidden, kind],
    })),

  reportDraft: null,
  startReport: (place) => set({ reportDraft: draftFor(place ?? null, place !== undefined), selection: null, followBus: false }),
  setReportPlace: (place) => set(({ reportDraft }) => (reportDraft && !reportDraft.fixed ? { reportDraft: movedTo(reportDraft, place) } : {})),
  setReportType: (type) => set(({ reportDraft }) => (reportDraft ? { reportDraft: { ...reportDraft, type, answer: null } } : {})),
  setReportAnswer: (answer) => set(({ reportDraft }) => (reportDraft ? { reportDraft: { ...reportDraft, answer } } : {})),
  closeReport: () => set({ reportDraft: null }),
  myReports: readMine(today()),
  addMyReport: (report) => set(({ myReports }) => ({ myReports: saved([...myReports, report]) })),
  markReportSent: (id, publishedId) =>
    set(({ myReports }) => ({
      myReports: saved(myReports.map((report) => (report.id === id ? { ...report, id: publishedId ?? id, sent: true } : report))),
    })),
  removeMyReport: (id, keepSelection) =>
    set(({ myReports, selection }) => ({
      myReports: saved(myReports.filter((report) => report.id !== id)),
      ...(!keepSelection && selection?.kind === 'report' && selection.id === id && { selection: null }),
    })),

  reportsVisible: readReportsVisible(),
  toggleReportsVisible: () =>
    set((state) => {
      storeReportsVisible(!state.reportsVisible);
      return { reportsVisible: !state.reportsVisible };
    }),

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
  sheetCover: 0,
  sheetRequest: null,
  requestSheet: (snap) => set({ sheetRequest: { snap } }),
  setSheetCover: (sheetCover) => set((state) => (state.sheetCover === sheetCover ? state : { sheetCover })),

  showToast: (toast) => set({ toast }),
  dismissToast: () => set({ toast: null }),
}));
