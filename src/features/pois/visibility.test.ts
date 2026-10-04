import { describe, expect, it } from 'vitest';
import { DEFAULT_POI_CATEGORIES } from './style';
import { parsePoiCategories, togglePoiCategory } from './visibility';

describe('parsePoiCategories', () => {
  it('gives the defaults when nothing usable is stored', () => {
    expect(parsePoiCategories(null)).toEqual(DEFAULT_POI_CATEGORIES);
    expect(parsePoiCategories('not json')).toEqual(DEFAULT_POI_CATEGORIES);
    expect(parsePoiCategories('{"food":true}')).toEqual(DEFAULT_POI_CATEGORIES);
  });

  it('keeps an empty choice and drops unknown categories', () => {
    expect(parsePoiCategories('[]')).toEqual([]);
    expect(parsePoiCategories('["parking","casino","food"]')).toEqual(['food', 'parking']);
  });
});

describe('togglePoiCategory', () => {
  it('adds and removes a category', () => {
    expect(togglePoiCategory(['food'], 'parking')).toEqual(['food', 'parking']);
    expect(togglePoiCategory(['food', 'parking'], 'food')).toEqual(['parking']);
  });
});
