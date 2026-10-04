import type { PoiCategory } from '../../domain/types';

type Tags = Record<string, string | undefined>;

const BY_AMENITY: Record<string, PoiCategory> = {
  restaurant: 'food',
  fast_food: 'food',
  cafe: 'food',
  food_court: 'food',
  bar: 'food',
  library: 'library',
  bank: 'bank',
  atm: 'atm',
  drinking_water: 'water',
  toilets: 'toilets',
  bicycle_rental: 'bike_rental',
  bicycle_parking: 'bike_parking',
  parking: 'parking',
  motorcycle_parking: 'parking',
  clinic: 'health',
  doctors: 'health',
  dentist: 'health',
  pharmacy: 'health',
  hospital: 'health',
  veterinary: 'health',
  theatre: 'culture',
  cinema: 'culture',
  arts_centre: 'culture',
  community_centre: 'culture',
  exhibition_centre: 'culture',
  music_school: 'culture',
  police: 'other',
  post_office: 'other',
  kindergarten: 'other',
  bus_station: 'other',
  taxi: 'other',
};

const BY_LEISURE: Record<string, PoiCategory> = {
  pitch: 'sport',
  track: 'sport',
  stadium: 'sport',
  sports_centre: 'sport',
  sports_hall: 'sport',
  swimming_pool: 'sport',
  fitness_centre: 'sport',
  park: 'park',
  garden: 'park',
  playground: 'park',
};

const BY_TOURISM: Record<string, PoiCategory> = {
  museum: 'culture',
  gallery: 'culture',
  artwork: 'culture',
  attraction: 'culture',
  information: 'info',
};

/**
 * Category of an OSM object, or `undefined` when it is not a point of interest
 * for this map (benches, waste baskets, institutes, plain buildings, ...).
 */
export function poiCategory(tags: Tags): PoiCategory | undefined {
  const category =
    (tags.amenity && BY_AMENITY[tags.amenity])
    || (tags.leisure && BY_LEISURE[tags.leisure])
    || (tags.tourism && BY_TOURISM[tags.tourism]);
  if (category) return category;
  if (tags.shop) return 'shop';
  // Named offices (associations, research groups) are worth finding by name.
  if (tags.office && tags.name) return 'other';
  return undefined;
}

/** Categories whose unnamed members are still worth listing in search ("banheiro", "bebedouro"). */
export const SEARCHABLE_UNNAMED: ReadonlySet<PoiCategory> = new Set(['toilets', 'water', 'atm', 'bike_rental']);
