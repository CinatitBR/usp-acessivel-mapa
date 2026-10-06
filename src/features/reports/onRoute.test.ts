import { describe, expect, it } from 'vitest';
import type { Report } from '../../domain/reports';
import type { LngLat } from '../../domain/types';
import { nearestOnLine, reportsOnRoute } from './onRoute';

/** About one metre, in degrees, at the campus. */
const M_LAT = 1 / 111_320;
const M_LNG = M_LAT / Math.cos((-23.56 * Math.PI) / 180);
const START: LngLat = [-46.73, -23.56];
/** A point so many metres east and north of the start. */
const at = (east: number, north: number): LngLat => [START[0] + east * M_LNG, START[1] + north * M_LAT];
/** 200 m east, then 100 m north. */
const LINE = [at(0, 0), at(200, 0), at(200, 100)];
const report = (fields: Partial<Report>): Report => ({ id: 'r', type: 'blocked', answer: 'no', position: at(100, 0), since: '2026-10-05', ...fields });

describe('nearestOnLine', () => {
  it('measures to the nearest stretch and along the line to it', () => {
    const beside = nearestOnLine(at(50, 8), LINE);
    expect(beside.distance).toBeCloseTo(8, 0);
    expect(beside.along).toBeCloseTo(50, 0);
    const second = nearestOnLine(at(205, 40), LINE);
    expect(second.distance).toBeCloseTo(5, 0);
    expect(second.along).toBeCloseTo(240, 0);
  });

  it('stops at the ends of the line', () => {
    const before = nearestOnLine(at(-30, 0), LINE);
    expect(before.distance).toBeCloseTo(30, 0);
    expect(before.along).toBeCloseTo(0, 0);
  });
});

describe('reportsOnRoute', () => {
  const destination = { position: at(200, 100), buildingId: 'way/1' };

  it('lists what the step-free route passes, in the order it is met', () => {
    const reports = [
      report({ id: 'late', type: 'narrow', answer: 'help', position: at(203, 60) }),
      report({ id: 'early', type: 'step', answer: 'no', position: at(40, -5) }),
      report({ id: 'middle', position: at(120, 10) }),
      report({ id: 'far', position: at(120, 30) }),
    ];
    const warnings = reportsOnRoute(LINE, 'wheelchair', reports, destination);
    expect(warnings.map(({ report: { id } }) => id)).toEqual(['early', 'middle', 'late']);
    expect(warnings[0]!.along).toBeCloseTo(40, 0);
    expect(warnings.every(({ atDestination }) => !atDestination)).toBe(true);
  });

  it('on foot warns only of a passage that cannot be passed', () => {
    const reports = [
      report({ id: 'blocked-no' }),
      report({ id: 'blocked-help', answer: 'help' }),
      report({ id: 'step', type: 'step', answer: 'no' }),
      report({ id: 'narrow', type: 'narrow', answer: 'no' }),
    ];
    expect(reportsOnRoute(LINE, 'walk', reports, destination).map(({ report: { id } }) => id)).toEqual(['blocked-no']);
  });

  it('warns of an elevator or toilet of the destination building, wherever its pin is, last', () => {
    const elevator = report({ id: 'elevator', type: 'elevator', answer: 'broken', position: at(260, 150), target: 'node/9' });
    const elsewhere = report({ id: 'other', type: 'elevator', answer: 'broken', position: at(100, 0), target: 'way/2' });
    const buildingOf = ({ id }: Report) => (id === 'elevator' ? 'way/1' : 'way/2');
    const warnings = reportsOnRoute(LINE, 'wheelchair', [elevator, elsewhere, report({ id: 'way' })], destination, buildingOf);
    expect(warnings.map(({ report: { id }, atDestination }) => [id, atDestination])).toEqual([['way', false], ['elevator', true]]);
    expect(reportsOnRoute(LINE, 'walk', [elevator], destination, buildingOf)).toEqual([]);
  });

  it('takes a report without a building as the destination\'s when it is right there', () => {
    const near = report({ id: 'near', type: 'toilet', answer: 'closed', position: at(210, 110) });
    const away = report({ id: 'away', type: 'toilet', answer: 'closed', position: at(200, 40) });
    expect(reportsOnRoute(LINE, 'wheelchair', [near, away], { position: at(200, 100) }).map(({ report: { id } }) => id)).toEqual(['near']);
  });

  it('gives nothing without a route', () => {
    expect(reportsOnRoute([], 'wheelchair', [report({})], destination)).toEqual([]);
  });
});
