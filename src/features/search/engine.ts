import MiniSearch from 'minisearch';
import type { Building, BusStop, GeocodeResult, Institute, LngLat, Poi } from '../../domain/types';
import { buildingKindLabel, strings } from '../../strings/pt-BR';
import { SEARCHABLE_UNNAMED } from '../pois/categories';

type RefType = NonNullable<GeocodeResult['ref']>['type'];

export type SearchDoc = {
  id: string;
  title: string;
  /** Short name or sigla. */
  alt: string;
  /** Extra terms that should find the document but are not shown. */
  keywords: string;
  detail?: string;
  position: LngLat;
  refType: RefType;
  refId: string;
  /** Ranking multiplier: institutes above buildings above POIs. */
  weight: number;
};

export type CampusData = { buildings: Building[]; pois: Poi[]; institutes: Institute[]; stops?: BusStop[] };

/** Lower-cases and strips accents, so "fisica" finds "Física". */
export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const joined = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ') || undefined;

export function buildDocs({ buildings, pois, institutes, stops = [] }: CampusData): SearchDoc[] {
  const instituteById = new Map(institutes.map((institute) => [institute.id, institute]));
  const buildingById = new Map(buildings.map((building) => [building.id, building]));

  const instituteDocs = institutes.map((institute): SearchDoc => ({
    id: `institute:${institute.id}`,
    title: institute.name,
    alt: institute.sigla ?? '',
    keywords: '',
    detail: joined(institute.sigla, strings.search.institute),
    position: institute.center,
    refType: 'institute',
    refId: institute.id,
    weight: 1.6,
  }));

  const buildingDocs = buildings.flatMap((building): SearchDoc[] => {
    if (!building.name) return [];
    const institute = building.institute ? instituteById.get(building.institute) : undefined;
    return [{
      id: `building:${building.id}`,
      title: building.name,
      alt: building.shortName ?? '',
      keywords: [institute?.name, institute?.sigla].filter(Boolean).join(' '),
      detail: institute?.sigla ?? institute?.name ?? buildingKindLabel(building.kind),
      position: building.center,
      refType: 'building',
      refId: building.id,
      weight: 1.2,
    }];
  });

  const poiDocs = pois.flatMap((poi): SearchDoc[] => {
    const category = strings.poi.categories[poi.category];
    if (!poi.name && !SEARCHABLE_UNNAMED.has(poi.category)) return [];
    // A POI that is itself a named building is already listed as that building.
    if (poi.buildingId === poi.id && buildingById.get(poi.id)?.name) return [];
    const building = poi.buildingId && poi.buildingId !== poi.id ? buildingById.get(poi.buildingId) : undefined;
    return [{
      id: `poi:${poi.id}`,
      title: poi.name ?? category,
      alt: '',
      keywords: category,
      detail: joined(poi.name ? category : undefined, building?.name),
      position: poi.position,
      refType: 'poi',
      refId: poi.id,
      weight: 1,
    }];
  });

  const stopDocs = stops.map((stop): SearchDoc => ({
    id: `stop:${stop.id}`,
    title: stop.name,
    alt: '',
    keywords: `${strings.transit.stop} ${stop.lineIds.join(' ')}`,
    detail: strings.transit.stop,
    position: stop.position,
    refType: 'stop',
    refId: stop.id,
    weight: 1.1,
  }));

  return [...instituteDocs, ...buildingDocs, ...stopDocs, ...poiDocs];
}

export type SearchFn = (query: string, limit?: number) => GeocodeResult[];

export function createSearch(docs: SearchDoc[]): SearchFn {
  const index = new MiniSearch<SearchDoc>({
    fields: ['title', 'alt', 'keywords'],
    storeFields: ['title', 'detail', 'position', 'refType', 'refId', 'weight'],
    processTerm: (term) => fold(term) || null,
    searchOptions: {
      prefix: true,
      // Typo tolerance only for longer words: on short siglas it matches nearly anything.
      fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      combineWith: 'AND',
      boost: { title: 3, alt: 3 },
      boostDocument: (_id, _term, stored) => (stored?.weight as number | undefined) ?? 1,
    },
  });
  index.addAll(docs);

  return (query, limit = 8) =>
    index.search(query).slice(0, limit).map((hit): GeocodeResult => ({
      id: String(hit.id),
      label: hit.title as string,
      detail: hit.detail as string | undefined,
      position: hit.position as LngLat,
      source: 'local',
      ref: { type: hit.refType as RefType, id: hit.refId as string },
    }));
}
