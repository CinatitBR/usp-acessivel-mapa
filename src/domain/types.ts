export type LngLat = [lng: number, lat: number];

/** `unknown` means nobody surveyed it yet; it never implies "not accessible". */
export type AccessStatus = 'yes' | 'partial' | 'no' | 'unknown';

export type DataSource = 'osm' | 'curated';

export interface AccessInfo {
  status: AccessStatus;
  source: DataSource;
  /** Accessible toilet inside. */
  toilet?: AccessStatus;
  elevator?: boolean;
  /** Number of reserved parking spaces. */
  parking?: number;
  /** Free text in pt-BR, from the curated overlay. */
  note?: string;
  /** ISO date of the last on-site check. */
  checked?: string;
}

export type AccessFeatureKind = 'ramp' | 'elevator' | 'entrance' | 'toilet' | 'parking' | 'kerb' | 'steps';

/** A single point that helps or hinders step-free movement. */
export interface AccessibilityFeature {
  id: string;
  kind: AccessFeatureKind;
  status: AccessStatus;
  position: LngLat;
  buildingId?: string;
  /** Floor, as in the OSM `level` tag. */
  level?: string;
  note?: string;
  checked?: string;
  source: DataSource;
}

export interface Building {
  /** OSM-style id: `way/123`, `relation/45`. */
  id: string;
  name?: string;
  shortName?: string;
  /** Id of the institute whose area contains the building. */
  institute?: string;
  /** OSM `building=*` value: university, dormitory, roof, yes, ... */
  kind: string;
  /** Metres above ground. */
  height: number;
  minHeight: number;
  center: LngLat;
  /** One-line street address. */
  address?: string;
  wiki?: WikiRef;
  website?: string;
  /** Name of its floor plan in public/data/indoor/, when it has an indoor map. */
  indoor?: string;
  access: AccessInfo;
}

/** A Portuguese Wikipedia article title, or a Wikidata id (`Q123`) that still has to be resolved to one. */
export type WikiRef = string;

/** A university unit or an independent institute with its own area on campus. */
export interface Institute {
  id: string;
  name: string;
  sigla?: string;
  center: LngLat;
  wiki?: WikiRef;
  website?: string;
}

export type PoiCategory =
  | 'food'
  | 'library'
  | 'bank'
  | 'atm'
  | 'water'
  | 'toilets'
  | 'bike_rental'
  | 'bike_parking'
  | 'parking'
  | 'health'
  | 'culture'
  | 'sport'
  | 'park'
  | 'shop'
  | 'info'
  | 'other';

export interface Poi {
  id: string;
  name?: string;
  category: PoiCategory;
  position: LngLat;
  access: AccessInfo;
  /** Id of the building that contains it, or its own id when the POI is a building. */
  buildingId?: string;
  openingHours?: string;
  wiki?: WikiRef;
  website?: string;
}

export interface BusStop {
  /** GTFS stop_id, which is also the Olho Vivo stop code. */
  id: string;
  name: string;
  /** Address and reference point, as SPTrans describes the stop. */
  description?: string;
  position: LngLat;
  /** Lines that call here, e.g. `['8082-10', '701U-10']`. */
  lineIds: string[];
  shelter?: boolean;
  access: AccessStatus;
}

/** One direction of a line that is drawn on the map and tracked live. */
export interface LineDirection {
  /** Line id, e.g. `8082-10`. */
  lineId: string;
  /** GTFS direction_id. */
  direction: 0 | 1;
  /** Destination shown on the bus. */
  headsign: string;
  name: string;
  color: string;
  /** Olho Vivo line code for this direction; without it the direction has no live positions. */
  code?: number;
  /**
   * A loop line is one direction in the GTFS but two codes in Olho Vivo, and its
   * buses change from one to the other on the way round. This is the second one.
   */
  loopCode?: number;
  /** Ids of the stops the line calls at, in order. A loop line may list a stop twice. */
  stopIds: string[];
  shape: LngLat[];
}

/** One GPS fix of a bus. */
export interface BusVehicle {
  /** Fleet number ("prefixo"), unique per bus. */
  id: string;
  lineId: string;
  direction: 0 | 1;
  position: LngLat;
  /** Epoch milliseconds of the fix. */
  recordedAt: number;
  /** The bus is wheelchair accessible. */
  accessible: boolean;
}

export interface Arrival {
  lineId: string;
  /** Destination shown on the bus. */
  headsign: string;
  /** Epoch milliseconds. */
  time: number;
  /**
   * `live` is a prediction from SPTrans; `scheduled` is the timetable; `estimated`
   * is worked out here from the position of a tracked bus, when SPTrans predicts nothing for it.
   */
  source: 'live' | 'scheduled' | 'estimated';
  vehicleId?: string;
  /** The bus itself is wheelchair accessible. */
  accessible?: boolean;
}

export interface GeocodeResult {
  id: string;
  label: string;
  detail?: string;
  position: LngLat;
  source: 'local' | 'photon';
  /** Present for local results: the campus object the result points to. */
  ref?: { type: 'building' | 'poi' | 'institute' | 'stop'; id: string };
}

export type RouteProfile = 'walk' | 'wheelchair';

export interface RouteStep {
  instruction: string;
  /** Metres. */
  distance: number;
  /** The step goes up or down stairs. */
  hasSteps?: boolean;
  /** Where the step runs: indexes into `Route.geometry`. */
  from: number;
  to: number;
}

export interface Route {
  provider: 'valhalla' | 'ors';
  profile: RouteProfile;
  /**
   * `guaranteed`: the provider excluded stairs. `best-effort`: it was asked to
   * avoid them but cannot promise. `no`: an ordinary walking route.
   */
  stepFree: 'guaranteed' | 'best-effort' | 'no';
  geometry: LngLat[];
  /** Metres. */
  distance: number;
  /** Seconds. */
  duration: number;
  steps: RouteStep[];
}
