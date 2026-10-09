import { describe, expect, it } from 'vitest';
import { POI_CATEGORIES, POI_STYLES } from './style';

describe('POI_STYLES', () => {
  it('gives every category a whole-number zoom, no earlier than the bus stops', () => {
    for (const category of POI_CATEGORIES) {
      const { minZoom } = POI_STYLES[category];
      expect(Number.isInteger(minZoom), category).toBe(true);
      expect(minZoom, category).toBeGreaterThanOrEqual(16);
    }
  });
});
