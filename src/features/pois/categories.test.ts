import { describe, expect, it } from 'vitest';
import { poiCategory } from './categories';

describe('poiCategory', () => {
  it('maps amenities, leisure and tourism tags', () => {
    expect(poiCategory({ amenity: 'restaurant' })).toBe('food');
    expect(poiCategory({ amenity: 'drinking_water' })).toBe('water');
    expect(poiCategory({ amenity: 'bicycle_rental' })).toBe('bike_rental');
    expect(poiCategory({ leisure: 'pitch' })).toBe('sport');
    expect(poiCategory({ tourism: 'museum' })).toBe('culture');
  });

  it('treats any shop as a shop and named offices as other', () => {
    expect(poiCategory({ shop: 'books' })).toBe('shop');
    expect(poiCategory({ office: 'association', name: 'ADUSP' })).toBe('other');
    expect(poiCategory({ office: 'association' })).toBeUndefined();
  });

  it('ignores street furniture, institutes and plain buildings', () => {
    expect(poiCategory({ amenity: 'bench' })).toBeUndefined();
    expect(poiCategory({ amenity: 'college', name: 'Instituto de Física' })).toBeUndefined();
    expect(poiCategory({ building: 'yes', name: 'Bloco A' })).toBeUndefined();
  });
});
