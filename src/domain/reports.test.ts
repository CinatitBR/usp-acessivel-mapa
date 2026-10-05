import { describe, expect, it } from 'vitest';
import { isActive, isTemporary, lastDay, type Report, reportStatus } from './reports';

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
