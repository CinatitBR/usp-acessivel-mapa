import { describe, expect, it } from 'vitest';
import { onCampus, placeAt } from './place';

const point = (coordinates: [number, number]) => ({ type: 'Point' as const, coordinates });

describe('placeAt', () => {
  it('is a spot on a path when nothing was hit', () => {
    expect(placeAt([-46.73, -23.56])).toEqual({ position: [-46.73, -23.56], label: 'Ponto no mapa', on: 'path' });
  });

  it('is the building under the finger, at the finger', () => {
    const feature = { geometry: { type: 'Polygon' as const, coordinates: [] }, properties: { id: 'way/1', name: 'FAU' } };
    expect(placeAt([-46.73, -23.56], feature, true)).toEqual({ position: [-46.73, -23.56], label: 'FAU', on: 'building', target: 'way/1' });
    expect(placeAt([-46.73, -23.56], { ...feature, properties: { id: 'way/1' } }, true).label).toBe('Edifício sem nome');
  });

  it('is the elevator or toilet that was hit, at its own position', () => {
    expect(placeAt([-46.7301, -23.5601], { geometry: point([-46.73, -23.56]), properties: { id: 'node/2', kind: 'elevator' } })).toEqual({
      position: [-46.73, -23.56], label: 'Elevador', on: 'elevator', target: 'node/2',
    });
    expect(placeAt([0, 0], { geometry: point([-46.73, -23.56]), properties: { id: 'node/3', kind: 'toilet' } }).on).toBe('toilet');
  });

  it('treats any other accessibility point as a spot on a path, but remembers it', () => {
    expect(placeAt([0, 0], { geometry: point([-46.73, -23.56]), properties: { id: 'node/4', kind: 'kerb' } })).toEqual({
      position: [-46.73, -23.56], label: 'Meio-fio', on: 'path', target: 'node/4',
    });
  });
});

describe('onCampus', () => {
  it('is true inside the campus box only', () => {
    expect(onCampus([-46.73, -23.56])).toBe(true);
    expect(onCampus([-46.70, -23.56])).toBe(false);
    expect(onCampus([-46.73, -23.50])).toBe(false);
  });
});
