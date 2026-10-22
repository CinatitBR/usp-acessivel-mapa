import { describe, expect, it } from 'vitest';
import type { BusPose } from './busTracker';
import { busFeatures, NO_BUSES, sameBusFeatures } from './busFeatures';

const pose = (id: string, position: [number, number]): BusPose => ({
  id,
  lineId: '8012-10',
  direction: 0,
  headsign: 'Metrô Butantã',
  color: '#ff671f',
  accessible: true,
  recordedAt: 0,
  position,
  heading: 0,
  along: 0,
  onRoute: true,
});

describe('busFeatures', () => {
  it('labels each bus with its line number', () => {
    const [feature] = busFeatures([pose('a', [-46.73, -23.56])]).features;
    expect(feature!.properties).toEqual({ id: 'a', color: '#ff671f', line: '8012' });
    expect(feature!.geometry.coordinates).toEqual([-46.73, -23.56]);
  });
});

describe('sameBusFeatures', () => {
  const here = busFeatures([pose('a', [-46.73, -23.56]), pose('b', [-46.72, -23.55])]);

  it('treats a move under a metre as no change', () => {
    expect(sameBusFeatures(here, busFeatures([pose('a', [-46.730004, -23.560003]), pose('b', [-46.72, -23.55])]))).toBe(true);
  });

  it('sees a bus that moved', () => {
    expect(sameBusFeatures(here, busFeatures([pose('a', [-46.7301, -23.56]), pose('b', [-46.72, -23.55])]))).toBe(false);
  });

  it('sees a bus that came or went', () => {
    expect(sameBusFeatures(here, busFeatures([pose('a', [-46.73, -23.56])]))).toBe(false);
    expect(sameBusFeatures(NO_BUSES, here)).toBe(false);
    expect(sameBusFeatures(NO_BUSES, busFeatures([]))).toBe(true);
  });
});
