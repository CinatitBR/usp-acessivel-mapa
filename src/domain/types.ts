export type LngLat = [lng: number, lat: number];

/** `unknown` means nobody surveyed it yet; it never implies "not accessible". */
export type AccessStatus = 'yes' | 'partial' | 'no' | 'unknown';

export type DataSource = 'osm' | 'curated';

export interface AccessInfo {
  status: AccessStatus;
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
  access: AccessInfo;
}

/** A university unit or an independent institute with its own area on campus. */
export interface Institute {
  id: string;
  name: string;
  sigla?: string;
  center: LngLat;
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
}

export interface GeocodeResult {
  id: string;
  label: string;
  detail?: string;
  position: LngLat;
  source: 'local' | 'photon';
  /** Present for local results: the campus object the result points to. */
  ref?: { type: 'building' | 'poi' | 'institute'; id: string };
}
