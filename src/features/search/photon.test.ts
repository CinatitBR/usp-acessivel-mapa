import { describe, expect, it } from 'vitest';
import { parsePhoton } from './photon';

const feature = (properties: Record<string, unknown>, coordinates: unknown = [-46.6655, -23.5243]) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties,
});

describe('parsePhoton', () => {
  it('builds a label and detail from name and address parts', () => {
    const [result] = parsePhoton({
      features: [
        feature({
          osm_type: 'W', osm_id: 469769804, name: 'Instituto de Física Teórica',
          street: 'Rua Doutor Bento Teobaldo Ferraz', housenumber: '271', district: 'Barra Funda', city: 'São Paulo',
        }),
      ],
    });
    expect(result).toEqual({
      id: 'photon/W469769804',
      label: 'Instituto de Física Teórica',
      detail: 'Rua Doutor Bento Teobaldo Ferraz, 271 · Barra Funda · São Paulo',
      position: [-46.6655, -23.5243],
      source: 'photon',
    });
  });

  it('falls back to the street when there is no name', () => {
    const [result] = parsePhoton({ features: [feature({ street: 'Avenida Paulista', housenumber: '1000', city: 'São Paulo' })] });
    expect(result?.label).toBe('Avenida Paulista, 1000');
    expect(result?.detail).toBe('São Paulo');
  });

  it('drops places inside the campus, unlabeled places and bad coordinates', () => {
    const results = parsePhoton({
      features: [
        feature({ name: 'Instituto de Física' }, [-46.7347, -23.561]),
        feature({ city: 'São Paulo' }),
        feature({ name: 'Sem coordenadas' }, ['x', 'y']),
        { properties: { name: 'Sem geometria' } },
      ],
    });
    expect(results).toEqual([]);
  });

  it('collapses entries with the same label and detail', () => {
    const street = { street: 'Avenida Paulista', district: 'Consolação', city: 'São Paulo', name: 'Avenida Paulista' };
    const results = parsePhoton({
      features: [feature({ ...street, osm_id: 1 }), feature({ ...street, osm_id: 2 }, [-46.66, -23.56])],
    });
    expect(results).toHaveLength(1);
  });

  it('tolerates malformed responses', () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({ features: 'nope' })).toEqual([]);
  });
});
