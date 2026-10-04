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
  /** OSM `building=*` value: university, dormitory, roof, yes, ... */
  kind: string;
  /** Metres above ground. */
  height: number;
  minHeight: number;
  center: LngLat;
  access: AccessInfo;
}
