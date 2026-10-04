import { describe, expect, it } from 'vitest';
import { formatAddress, nearestRoad, website, wikiRef } from './address';

describe('formatAddress', () => {
  it('joins street, number and postcode from Nominatim', () => {
    expect(formatAddress({}, { road: 'Travessa 4', house_number: '380', postcode: '05508-010' })).toBe('Travessa 4, 380 · 05508-010');
    expect(formatAddress({}, { road: 'Rua do Lago' })).toBe('Rua do Lago');
  });

  it("prefers the building's own address tags", () => {
    expect(
      formatAddress({ 'addr:street': 'Rua do Matão', 'addr:housenumber': '1010' }, { road: 'Rua do Lago', postcode: '05508-090' }),
    ).toBe('Rua do Matão, 1010 · 05508-090');
  });

  it('uses the nearest street when nothing else names one', () => {
    expect(formatAddress({}, undefined, 'Rua do Matão')).toBe('Rua do Matão');
    expect(formatAddress({}, { road: 'Rua do Lago' }, 'Rua do Matão')).toBe('Rua do Lago');
  });

  it('is undefined without a street', () => {
    expect(formatAddress({}, { postcode: '05508-090' })).toBeUndefined();
    expect(formatAddress({}, undefined)).toBeUndefined();
  });
});

describe('nearestRoad', () => {
  const roads = [
    { name: 'Rua do Matão', line: [[-46.735, -23.56], [-46.725, -23.56]] as [number, number][] },
    { name: 'Rua do Lago', line: [[-46.735, -23.562], [-46.725, -23.562]] as [number, number][] },
  ];

  it('names the closest street', () => {
    expect(nearestRoad([-46.73, -23.5604], roads, 150)).toBe('Rua do Matão');
    expect(nearestRoad([-46.73, -23.5617], roads, 150)).toBe('Rua do Lago');
  });

  it('gives up beyond the limit', () => {
    expect(nearestRoad([-46.73, -23.555], roads, 150)).toBeUndefined();
  });
});

describe('wikiRef', () => {
  it('takes the Portuguese article title', () => {
    expect(wikiRef({ wikipedia: 'pt:Biblioteca Brasiliana Guita e José Mindlin', wikidata: 'Q18500412' })).toBe(
      'Biblioteca Brasiliana Guita e José Mindlin',
    );
    expect(wikiRef({ wikipedia: 'Instituto_Butantan' })).toBe('Instituto Butantan');
  });

  it('falls back to the Wikidata id when there is no Portuguese article tag', () => {
    expect(wikiRef({ wikidata: 'Q9004924' })).toBe('Q9004924');
    expect(wikiRef({ wikipedia: 'en:University of São Paulo', wikidata: 'Q835960' })).toBe('Q835960');
  });

  it('is undefined without usable tags', () => {
    expect(wikiRef({})).toBeUndefined();
    expect(wikiRef({ wikidata: 'not an id' })).toBeUndefined();
  });
});

describe('website', () => {
  it('accepts web links and adds a missing scheme', () => {
    expect(website({ 'contact:website': 'http://www.bbm.usp.br/' })).toBe('http://www.bbm.usp.br/');
    expect(website({ website: 'www.fau.usp.br' })).toBe('https://www.fau.usp.br/');
  });

  it('rejects anything else', () => {
    expect(website({ website: 'javascript:alert(1)' })).toBeUndefined();
    expect(website({})).toBeUndefined();
  });
});
