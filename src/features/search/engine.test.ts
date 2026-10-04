import { describe, expect, it } from 'vitest';
import type { Building, Institute, Poi } from '../../domain/types';
import { buildDocs, createSearch, fold } from './engine';

const access = { status: 'unknown', source: 'osm' } as const;
const building = (id: string, extra: Partial<Building> = {}): Building => ({
  id, kind: 'university', height: 10, minHeight: 0, center: [-46.73, -23.56], access, ...extra,
});

const institutes: Institute[] = [
  { id: 'way/if', name: 'Instituto de Física', sigla: 'IFUSP', center: [-46.7347, -23.561] },
  { id: 'way/ime', name: 'Instituto de Matemática e Estatística', sigla: 'IME', center: [-46.7316, -23.5594] },
];
const buildings: Building[] = [
  building('way/1', { name: 'Edifício Principal', institute: 'way/if' }),
  building('way/2', { name: 'Biblioteca do Instituto de Física', institute: 'way/if' }),
  building('way/3', { name: 'Bloco A', shortName: 'BA', institute: 'way/ime' }),
  building('way/4'),
];
const pois: Poi[] = [
  { id: 'node/1', name: 'Restaurante Central', category: 'food', position: [-46.72, -23.56], access },
  { id: 'node/2', category: 'toilets', position: [-46.73, -23.56], access, buildingId: 'way/3' },
  { id: 'node/3', category: 'parking', position: [-46.73, -23.56], access },
  { id: 'way/2', name: 'Biblioteca do Instituto de Física', category: 'library', position: [-46.73, -23.56], access, buildingId: 'way/2' },
];

const search = createSearch(buildDocs({ buildings, pois, institutes }));
const labels = (query: string) => search(query).map((result) => result.label);

describe('fold', () => {
  it('removes accents and case', () => {
    expect(fold('Física')).toBe('fisica');
    expect(fold('ESTAÇÃO')).toBe('estacao');
  });
});

describe('buildDocs', () => {
  const docs = buildDocs({ buildings, pois, institutes });

  it('indexes institutes, named buildings and useful POIs only', () => {
    const ids = docs.map((doc) => doc.id);
    expect(ids).toContain('institute:way/if');
    expect(ids).toContain('building:way/1');
    expect(ids).not.toContain('building:way/4');
    expect(ids).toContain('poi:node/2');
    expect(ids).not.toContain('poi:node/3');
  });

  it('does not list a POI twice when it is a named building', () => {
    expect(docs.map((doc) => doc.id)).not.toContain('poi:way/2');
  });

  it('titles unnamed POIs by category and mentions their building', () => {
    expect(docs.find((doc) => doc.id === 'poi:node/2')).toMatchObject({ title: 'Banheiro', detail: 'Bloco A' });
  });
});

describe('search', () => {
  it('ignores accents and ranks the institute first', () => {
    expect(labels('fisica')[0]).toBe('Instituto de Física');
    expect(labels('fisica')).toContain('Biblioteca do Instituto de Física');
  });

  it('finds by sigla, prefix and category', () => {
    expect(labels('IME')[0]).toBe('Instituto de Matemática e Estatística');
    expect(labels('matem')).toContain('Instituto de Matemática e Estatística');
    expect(labels('banheiro')).toEqual(['Banheiro']);
  });

  it('finds buildings through their institute', () => {
    expect(labels('ifusp')).toContain('Edifício Principal');
  });

  it('tolerates a typo in longer words', () => {
    expect(labels('restaurnte')).toContain('Restaurante Central');
  });

  it('returns typed references for selection', () => {
    expect(search('bloco a')[0]).toMatchObject({ source: 'local', ref: { type: 'building', id: 'way/3' } });
  });

  it('returns nothing for unmatched or empty queries', () => {
    expect(search('zzzzzz')).toEqual([]);
    expect(search('')).toEqual([]);
  });
});
