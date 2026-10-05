import { describe, expect, it } from 'vitest';
import { draftFor, isActive, isTemporary, lastDay, movedTo, type Report, type ReportPlace, reportStatus } from './reports';

const report = (fields: Partial<Report>): Report => ({ id: 'r', type: 'blocked', answer: 'no', position: [-46.73, -23.56], since: '2026-10-05', ...fields });

describe('isTemporary', () => {
  it('follows the type and the answer', () => {
    expect(isTemporary({ type: 'blocked', answer: 'yes' })).toBe(true);
    expect(isTemporary({ type: 'elevator', answer: 'broken' })).toBe(true);
    expect(isTemporary({ type: 'toilet', answer: 'closed' })).toBe(true);
    expect(isTemporary({ type: 'elevator', answer: 'missing' })).toBe(false);
    expect(isTemporary({ type: 'toilet', answer: 'missing' })).toBe(false);
    expect(isTemporary({ type: 'step', answer: 'no' })).toBe(false);
    expect(isTemporary({ type: 'narrow', answer: 'help' })).toBe(false);
  });
});

describe('lastDay', () => {
  it('is the end date the reviewer gave', () => {
    expect(lastDay(report({ until: '2026-11-30' }))).toBe('2026-11-30');
    expect(lastDay(report({ type: 'step', until: '2027-01-01' }))).toBe('2027-01-01');
  });

  it('defaults by type for temporary reports, across a month end', () => {
    expect(lastDay(report({ since: '2026-10-28' }))).toBe('2026-11-04');
    expect(lastDay(report({ type: 'elevator', answer: 'broken' }))).toBe('2026-10-19');
    expect(lastDay(report({ type: 'toilet', answer: 'closed' }))).toBe('2026-10-19');
  });

  it('is open for permanent reports', () => {
    expect(lastDay(report({ type: 'step' }))).toBeUndefined();
    expect(lastDay(report({ type: 'elevator', answer: 'missing' }))).toBeUndefined();
  });
});

describe('lastDay after a confirmation', () => {
  it('runs the default days again from the day it was confirmed', () => {
    expect(lastDay(report({ confirmed: '2026-10-10' }))).toBe('2026-10-17');
    expect(lastDay(report({ type: 'elevator', answer: 'broken', confirmed: '2026-10-10' }))).toBe('2026-10-24');
  });

  it('can outlast the end date a reviewer gave, but never shortens it', () => {
    expect(lastDay(report({ until: '2026-10-08', confirmed: '2026-10-08' }))).toBe('2026-10-15');
    expect(lastDay(report({ until: '2026-11-30', confirmed: '2026-10-08' }))).toBe('2026-11-30');
  });

  it('does not touch a permanent report', () => {
    expect(lastDay(report({ type: 'step', confirmed: '2026-10-10' }))).toBeUndefined();
    expect(lastDay(report({ type: 'narrow', until: '2027-01-01', confirmed: '2026-10-10' }))).toBe('2027-01-01');
  });
});

describe('isActive', () => {
  it('holds from the day it was reported to its last day, both included', () => {
    const blocked = report({});
    expect(isActive(blocked, '2026-10-04')).toBe(false);
    expect(isActive(blocked, '2026-10-05')).toBe(true);
    expect(isActive(blocked, '2026-10-12')).toBe(true);
    expect(isActive(blocked, '2026-10-13')).toBe(false);
  });

  it('never ends for a permanent report without an end date', () => {
    expect(isActive(report({ type: 'narrow' }), '2031-01-01')).toBe(true);
  });
});

describe('reportStatus', () => {
  it('is amber when one can get through, even with help, and red otherwise', () => {
    expect(reportStatus({ answer: 'yes' })).toBe('partial');
    expect(reportStatus({ answer: 'help' })).toBe('partial');
    for (const answer of ['no', 'broken', 'closed', 'missing'] as const) expect(reportStatus({ answer })).toBe('no');
  });
});

describe('a draft', () => {
  const path: ReportPlace = { position: [-46.73, -23.56], label: 'Ponto no mapa', on: 'path' };
  const building: ReportPlace = { position: [-46.73, -23.56], label: 'FAU', on: 'building', target: 'way/1' };
  const elevator: ReportPlace = { position: [-46.73, -23.56], label: 'Elevador', on: 'elevator', target: 'node/2' };

  it('starts at the place, or at the type when the place is known', () => {
    expect(draftFor(null, false)).toEqual({ place: null, fixed: false, type: null, answer: null });
    expect(draftFor(building, true)).toEqual({ place: building, fixed: true, type: null, answer: null });
  });

  it('skips the type when the place allows only one', () => {
    expect(draftFor(elevator, true).type).toBe('elevator');
  });

  it('keeps the type and the answer when the place moves to one that still offers it', () => {
    const draft = { ...draftFor(path, false), type: 'blocked' as const, answer: 'no' as const };
    expect(movedTo(draft, building)).toEqual({ place: building, fixed: false, type: 'blocked', answer: 'no' });
  });

  it('drops a type the new place does not offer, and its answer', () => {
    const draft = { ...draftFor(path, false), type: 'narrow' as const, answer: 'help' as const };
    expect(movedTo(draft, building)).toMatchObject({ type: null, answer: null });
    expect(movedTo(draft, elevator)).toMatchObject({ type: 'elevator', answer: null });
  });
});
