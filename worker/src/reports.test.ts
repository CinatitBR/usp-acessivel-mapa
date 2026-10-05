import { describe, expect, it } from 'vitest';
import { isReportId, newReportId, parseSubmission, todayInSaoPaulo } from './reports';
import { toPublished } from './reportsDb';

describe('parseSubmission', () => {
  const good = { type: 'blocked', answer: 'no', at: [-46.7251851, -23.5629561] };

  it('accepts a report and rounds its place', () => {
    expect(parseSubmission({ ...good, target: 'way/158966879', note: '  Tapume  ' })).toEqual({
      type: 'blocked', answer: 'no', at: [-46.725185, -23.562956], target: 'way/158966879', note: 'Tapume',
    });
    expect(parseSubmission(good)).toEqual({ type: 'blocked', answer: 'no', at: [-46.725185, -23.562956] });
  });

  it('drops an empty note and fields it does not know', () => {
    expect(parseSubmission({ ...good, note: '   ', id: 'x', until: '2030-01-01' })).toEqual({ type: 'blocked', answer: 'no', at: [-46.725185, -23.562956] });
  });

  it('refuses anything else', () => {
    const refused = [
      null,
      'text',
      [good],
      { ...good, type: 'pothole' },
      { ...good, answer: 'broken' },
      { type: 'elevator', answer: 'no', at: good.at },
      { ...good, at: [-43.2, -22.9] },
      { ...good, at: ['-46.72', '-23.56'] },
      { ...good, at: [-46.72, -23.56, 700] },
      { ...good, target: '<script>' },
      { ...good, target: 7 },
      { ...good, note: 'x'.repeat(281) },
      { ...good, note: 5 },
    ];
    for (const body of refused) expect(parseSubmission(body)).toHaveProperty('error');
  });
});

describe('newReportId', () => {
  it('makes ids of the accepted shape, different each time', () => {
    const ids = new Set(Array.from({ length: 50 }, newReportId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^r-[0-9a-f]{8}$/);
    expect([...ids].every(isReportId)).toBe(true);
    expect(isReportId('r12')).toBe(true);
    expect(isReportId("x' OR 1=1")).toBe(false);
    expect(isReportId('')).toBe(false);
  });
});

describe('todayInSaoPaulo', () => {
  it('is the local day, three hours behind UTC', () => {
    expect(todayInSaoPaulo(new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05');
    expect(todayInSaoPaulo(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-06');
  });
});

describe('toPublished', () => {
  const row = { id: 'r1', type: 'blocked' as const, answer: 'no' as const, lng: -46.73, lat: -23.56, target: null, since: '2026-10-05', until: null, publicNote: null };

  it('gives the app only what is set', () => {
    expect(toPublished(row)).toEqual({ id: 'r1', type: 'blocked', answer: 'no', at: [-46.73, -23.56], since: '2026-10-05' });
  });

  it('passes on the target, the end date and the reviewer\'s note', () => {
    expect(toPublished({ ...row, target: 'way/1', until: '2026-10-20', publicNote: 'Tapume' })).toEqual({
      id: 'r1', type: 'blocked', answer: 'no', at: [-46.73, -23.56], target: 'way/1', since: '2026-10-05', until: '2026-10-20', note: 'Tapume',
    });
  });
});
